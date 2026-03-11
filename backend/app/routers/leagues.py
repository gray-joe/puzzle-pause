from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import generate_invite_code, require_user
from ..database import get_db
from ..models import League, LeagueMember
from ..schemas import (
    CreateLeagueRequest,
    JoinLeagueRequest,
    LeaderboardEntry,
    LeagueDetailResponse,
    LeagueResponse,
    LeagueTagsResponse,
    TagEntry,
)

router = APIRouter(prefix="/leagues", tags=["leagues"])
limiter = Limiter(key_func=get_remote_address)

LEADERBOARD_SQL_TODAY = """
SELECT u.id, COALESCE(u.display_name, u.email), u.email, COALESCE(a.score, -1) as score
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN puzzles p ON p.puzzle_date = date('now')
LEFT JOIN attempts a ON a.user_id = u.id AND a.puzzle_id = p.id AND a.solved = 1
WHERE lm.league_id = :league_id
ORDER BY
  CASE WHEN a.score IS NULL THEN 1 ELSE 0 END,
  COALESCE(a.score, 0) DESC,
  COALESCE(u.display_name, u.email) ASC
"""

LEADERBOARD_SQL_WEEKLY = """
SELECT u.id, COALESCE(u.display_name, u.email), u.email, COALESCE(SUM(a.score), 0) as total_score
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN puzzles p ON p.puzzle_date >= date('now', 'weekday 0', '-6 days')
  AND p.puzzle_date <= date('now')
LEFT JOIN attempts a ON a.user_id = u.id AND a.puzzle_id = p.id AND a.solved = 1
WHERE lm.league_id = :league_id
GROUP BY u.id
ORDER BY total_score DESC, COALESCE(u.display_name, u.email) ASC
"""

LEADERBOARD_SQL_ALLTIME = """
SELECT u.id, COALESCE(u.display_name, u.email), u.email, COALESCE(SUM(a.score), 0) as total_score
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN attempts a ON a.user_id = u.id AND a.solved = 1
WHERE lm.league_id = :league_id
GROUP BY u.id
ORDER BY total_score DESC, COALESCE(u.display_name, u.email) ASC
"""


def _run_leaderboard(db: Session, league_id: int, sql: str) -> list[LeaderboardEntry]:
    rows = db.execute(text(sql), {"league_id": league_id}).fetchall()
    entries = []
    prev_score = None
    rank = 0
    for i, row in enumerate(rows):
        score = row[3]
        if score != prev_score:
            rank = i + 1
            prev_score = score
        entries.append(
            LeaderboardEntry(
                user_id=row[0],
                display_name=row[1],
                score=score,
                rank=rank,
            )
        )
    return entries


TAGS_SQL = """
WITH league_attempts AS (
  SELECT lm.user_id, COALESCE(u.display_name, u.email) AS name,
    a.incorrect_guesses, a.solved, a.hint_used, a.completed_at
  FROM league_members lm
  JOIN users u ON u.id = lm.user_id
  JOIN attempts a ON a.user_id = lm.user_id
  WHERE lm.league_id = :league_id
),
guesser AS (
  SELECT user_id, name FROM league_attempts
  WHERE incorrect_guesses > 0
  GROUP BY user_id ORDER BY SUM(incorrect_guesses) DESC LIMIT 1
),
one_shotter AS (
  SELECT user_id, name FROM league_attempts
  WHERE solved = 1
  GROUP BY user_id HAVING COUNT(*) >= 3
  ORDER BY (CAST(SUM(CASE WHEN incorrect_guesses = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) DESC,
    COUNT(*) DESC LIMIT 1
),
early_riser AS (
  SELECT user_id, name FROM league_attempts
  WHERE solved = 1 AND completed_at IS NOT NULL
  GROUP BY user_id HAVING COUNT(*) >= 3
  ORDER BY AVG(
    CAST(strftime('%H', completed_at) AS INTEGER) * 3600 +
    CAST(strftime('%M', completed_at) AS INTEGER) * 60 +
    CAST(strftime('%S', completed_at) AS INTEGER)
  ) ASC LIMIT 1
),
hint_lover AS (
  SELECT user_id, name FROM league_attempts
  WHERE hint_used = 1
  GROUP BY user_id ORDER BY SUM(hint_used) DESC LIMIT 1
)
SELECT 'guesser' AS tag, user_id, name FROM guesser
UNION ALL SELECT 'one_shotter', user_id, name FROM one_shotter
UNION ALL SELECT 'early_riser', user_id, name FROM early_riser
UNION ALL SELECT 'hint_lover', user_id, name FROM hint_lover
"""


def _get_tags(db: Session, league_id: int) -> LeagueTagsResponse:
    rows = db.execute(text(TAGS_SQL), {"league_id": league_id}).fetchall()
    tags: dict[str, TagEntry] = {}
    for row in rows:
        tags[row[0]] = TagEntry(user_id=row[1], display_name=row[2])
    return LeagueTagsResponse(
        guesser=tags.get("guesser"),
        one_shotter=tags.get("one_shotter"),
        early_riser=tags.get("early_riser"),
        hint_lover=tags.get("hint_lover"),
    )


def _member_count(db: Session, league_id: int) -> int:
    return db.query(LeagueMember).filter(LeagueMember.league_id == league_id).count()


def _to_response(
    league: League, db: Session, user_id: int | None = None
) -> LeagueResponse:
    user_rank = None
    user_score = 0
    if user_id is not None:
        entries = _run_leaderboard(db, league.id, LEADERBOARD_SQL_ALLTIME)
        for entry in entries:
            if entry.user_id == user_id:
                user_rank = entry.rank
                user_score = entry.score
                break
    return LeagueResponse(
        id=league.id,
        name=league.name,
        invite_code=league.invite_code,
        creator_id=league.creator_id,
        member_count=_member_count(db, league.id),
        user_rank=user_rank,
        user_score=user_score,
    )


LIST_LEAGUES_SQL = """
WITH user_leagues AS (
  SELECT league_id FROM league_members WHERE user_id = :uid
),
member_counts AS (
  SELECT league_id, COUNT(*) AS cnt FROM league_members
  WHERE league_id IN (SELECT league_id FROM user_leagues)
  GROUP BY league_id
),
alltime_scores AS (
  SELECT lm.league_id, lm.user_id, COALESCE(SUM(a.score), 0) AS total_score
  FROM league_members lm
  LEFT JOIN attempts a ON a.user_id = lm.user_id AND a.solved = 1
  WHERE lm.league_id IN (SELECT league_id FROM user_leagues)
  GROUP BY lm.league_id, lm.user_id
),
ranked AS (
  SELECT league_id, user_id, total_score,
    RANK() OVER (PARTITION BY league_id ORDER BY total_score DESC) AS rnk
  FROM alltime_scores
)
SELECT l.id, l.name, l.invite_code, l.creator_id,
  mc.cnt, r.rnk, r.total_score
FROM leagues l
JOIN user_leagues ul ON ul.league_id = l.id
JOIN member_counts mc ON mc.league_id = l.id
LEFT JOIN ranked r ON r.league_id = l.id AND r.user_id = :uid
ORDER BY l.name
"""


@router.get("")
def list_leagues(user=Depends(require_user), db: Session = Depends(get_db)):
    rows = db.execute(text(LIST_LEAGUES_SQL), {"uid": user.id}).fetchall()
    return [
        LeagueResponse(
            id=row[0],
            name=row[1],
            invite_code=row[2],
            creator_id=row[3],
            member_count=row[4],
            user_rank=row[5],
            user_score=row[6] or 0,
        )
        for row in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_league(
    request: Request,
    body: CreateLeagueRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    for _ in range(10):
        code = generate_invite_code()
        if not db.query(League).filter(League.invite_code == code).first():
            break
    else:
        raise HTTPException(
            status_code=500, detail="Could not generate unique invite code"
        )

    league = League(name=body.name, invite_code=code, creator_id=user.id)
    db.add(league)
    db.flush()

    member = LeagueMember(league_id=league.id, user_id=user.id)
    db.add(member)
    db.commit()
    db.refresh(league)

    return _to_response(league, db)


@router.get("/{league_id}")
def get_league(
    league_id: int, user=Depends(require_user), db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    if (
        not db.query(LeagueMember)
        .filter(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id == user.id,
        )
        .first()
    ):
        raise HTTPException(status_code=403, detail="Not a member")

    return LeagueDetailResponse(
        id=league.id,
        name=league.name,
        invite_code=league.invite_code,
        creator_id=league.creator_id,
        member_count=_member_count(db, league_id),
        leaderboard_today=_run_leaderboard(db, league_id, LEADERBOARD_SQL_TODAY),
        leaderboard_weekly=_run_leaderboard(db, league_id, LEADERBOARD_SQL_WEEKLY),
        leaderboard_alltime=_run_leaderboard(db, league_id, LEADERBOARD_SQL_ALLTIME),
        tags=_get_tags(db, league_id),
    )


@router.post("/join")
@limiter.limit("10/minute")
def join_league(
    request: Request,
    body: JoinLeagueRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    code = body.invite_code.upper()
    league = db.query(League).filter(League.invite_code == code).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    existing = (
        db.query(LeagueMember)
        .filter(
            LeagueMember.league_id == league.id,
            LeagueMember.user_id == user.id,
        )
        .first()
    )
    if existing:
        return _to_response(league, db)

    member = LeagueMember(league_id=league.id, user_id=user.id)
    db.add(member)
    db.commit()

    return _to_response(league, db)


@router.delete("/{league_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_league(
    league_id: int, user=Depends(require_user), db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only creator can delete")

    db.query(LeagueMember).filter(LeagueMember.league_id == league_id).delete()
    db.delete(league)
    db.commit()


@router.post("/{league_id}/leave", status_code=status.HTTP_200_OK)
def leave_league(
    league_id: int, user=Depends(require_user), db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    member = (
        db.query(LeagueMember)
        .filter(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id == user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")

    count = _member_count(db, league_id)

    if count == 1:
        db.delete(member)
        db.delete(league)
        db.commit()
        return {"message": "League deleted"}

    if league.creator_id == user.id:
        new_creator = (
            db.query(LeagueMember)
            .filter(
                LeagueMember.league_id == league_id, LeagueMember.user_id != user.id
            )
            .order_by(LeagueMember.joined_at.asc())
            .first()
        )
        if new_creator:
            league.creator_id = new_creator.user_id

    db.delete(member)
    db.commit()
    return {"message": "Left league"}
