from fastapi import APIRouter, Depends, HTTPException, status
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


def _get_tags(db: Session, league_id: int) -> LeagueTagsResponse:
    def _tag(sql: str) -> TagEntry | None:
        row = db.execute(text(sql), {"league_id": league_id}).fetchone()
        if not row:
            return None
        return TagEntry(user_id=row[0], display_name=row[1] or row[2])

    return LeagueTagsResponse(
        guesser=_tag(
            "SELECT lm.user_id, u.display_name, u.email FROM league_members lm "
            "JOIN users u ON u.id = lm.user_id "
            "JOIN attempts a ON a.user_id = lm.user_id "
            "WHERE lm.league_id = :league_id AND a.incorrect_guesses > 0 "
            "GROUP BY lm.user_id ORDER BY SUM(a.incorrect_guesses) DESC LIMIT 1"
        ),
        one_shotter=_tag(
            "SELECT lm.user_id, u.display_name, u.email FROM league_members lm "
            "JOIN users u ON u.id = lm.user_id "
            "JOIN attempts a ON a.user_id = lm.user_id "
            "WHERE lm.league_id = :league_id AND a.solved = 1 "
            "GROUP BY lm.user_id HAVING COUNT(*) >= 3 "
            "ORDER BY (CAST(SUM(CASE WHEN a.incorrect_guesses = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) DESC, "
            "COUNT(*) DESC LIMIT 1"
        ),
        early_riser=_tag(
            "SELECT lm.user_id, u.display_name, u.email FROM league_members lm "
            "JOIN users u ON u.id = lm.user_id "
            "JOIN attempts a ON a.user_id = lm.user_id "
            "WHERE lm.league_id = :league_id AND a.solved = 1 AND a.completed_at IS NOT NULL "
            "GROUP BY lm.user_id HAVING COUNT(*) >= 3 "
            "ORDER BY AVG(CAST(strftime('%H', a.completed_at) AS INTEGER) * 3600 + "
            "CAST(strftime('%M', a.completed_at) AS INTEGER) * 60 + "
            "CAST(strftime('%S', a.completed_at) AS INTEGER)) ASC LIMIT 1"
        ),
        hint_lover=_tag(
            "SELECT lm.user_id, u.display_name, u.email FROM league_members lm "
            "JOIN users u ON u.id = lm.user_id "
            "JOIN attempts a ON a.user_id = lm.user_id "
            "WHERE lm.league_id = :league_id AND a.hint_used = 1 "
            "GROUP BY lm.user_id ORDER BY SUM(a.hint_used) DESC LIMIT 1"
        ),
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


@router.get("")
def list_leagues(user=Depends(require_user), db: Session = Depends(get_db)):
    memberships = db.query(LeagueMember).filter(LeagueMember.user_id == user.id).all()
    league_ids = [m.league_id for m in memberships]
    leagues = db.query(League).filter(League.id.in_(league_ids)).all()
    return [_to_response(l, db, user_id=user.id) for l in leagues]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_league(
    body: CreateLeagueRequest, user=Depends(require_user), db: Session = Depends(get_db)
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
def join_league(
    body: JoinLeagueRequest, user=Depends(require_user), db: Session = Depends(get_db)
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
