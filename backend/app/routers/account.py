from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import GUEST_SESSION_COOKIE, get_current_user, require_user
from ..database import get_db
from ..schemas import (
    AccountResponse,
    AccountStatsResponse,
    UpdateAccountRequest,
    UserResponse,
)

router = APIRouter(prefix="/account", tags=["account"])
limiter = Limiter(key_func=get_remote_address)


def _parse_date_param(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc


def _get_stats(user_id: int, db: Session) -> AccountStatsResponse:
    row = db.execute(
        text(
            "SELECT COALESCE(SUM(score), 0), COUNT(*), COALESCE(AVG(score), 0) "
            "FROM attempts WHERE user_id = :uid AND solved = 1"
        ),
        {"uid": user_id},
    ).fetchone()
    alltime_total = row[0] if row else 0
    puzzles_solved = row[1] if row else 0
    avg_score = float(row[2]) if row else 0.0

    weekly = (
        db.execute(
            text(
                "SELECT COALESCE(SUM(a.score), 0) "
                "FROM attempts a JOIN puzzles p ON a.puzzle_id = p.id "
                "WHERE a.user_id = :uid AND a.solved = 1 "
                "AND p.puzzle_date >= date('now', 'weekday 0', '-6 days') "
                "AND p.puzzle_date <= date('now')"
            ),
            {"uid": user_id},
        ).scalar()
        or 0
    )

    percentile_row = db.execute(
        text(
            "SELECT COUNT(*) AS total, "
            "SUM(CASE WHEN total_score <= :score THEN 1 ELSE 0 END) AS below_or_equal "
            "FROM (SELECT user_id, SUM(score) AS total_score "
            "FROM attempts WHERE solved = 1 GROUP BY user_id)"
        ),
        {"score": alltime_total},
    ).fetchone()
    if percentile_row and percentile_row[0] > 1:
        percentile = max(
            1,
            round(100 * (percentile_row[0] - percentile_row[1]) / percentile_row[0])
        )
    else:
        percentile = None

    today_score = db.execute(
        text(
            "SELECT a.score FROM attempts a JOIN puzzles p ON a.puzzle_id = p.id "
            "WHERE a.user_id = :uid AND a.solved = 1 AND p.puzzle_date = date('now')"
        ),
        {"uid": user_id},
    ).scalar()

    streak_rows = db.execute(
        text(
            "SELECT DISTINCT p.puzzle_date FROM attempts a "
            "JOIN puzzles p ON a.puzzle_id = p.id "
            "WHERE a.user_id = :uid AND a.solved = 1 AND a.source = 'daily' "
            "ORDER BY p.puzzle_date DESC "
            "LIMIT 365"
        ),
        {"uid": user_id},
    ).fetchall()

    from datetime import date, timedelta

    streak = 0
    today = date.today()
    expected = None
    for (d,) in streak_rows:
        puzzle_day = date.fromisoformat(d)
        if expected is None:
            if puzzle_day >= today - timedelta(days=1):
                expected = puzzle_day - timedelta(days=1)
                streak = 1
            else:
                break
        elif puzzle_day == expected:
            streak += 1
            expected -= timedelta(days=1)
        else:
            break

    return AccountStatsResponse(
        puzzles_solved=puzzles_solved,
        average_score=avg_score,
        alltime_total=alltime_total,
        weekly_total=weekly,
        today_score=today_score,
        percentile=percentile,
        streak=streak,
    )


@router.get("/completed-dates")
def get_completed_dates(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    start: str = Query(max_length=10),
    end: str = Query(max_length=10),
):
    start_date = _parse_date_param(start)
    end_date = _parse_date_param(end)
    completed_dates: set[str] = set()
    gave_up_dates: set[str] = set()

    if user:
        rows = db.execute(
            text(
                "SELECT DISTINCT p.puzzle_date, a.solved, a.gave_up FROM attempts a "
                "JOIN puzzles p ON a.puzzle_id = p.id "
                "WHERE a.user_id = :uid AND (a.solved = 1 OR a.gave_up = 1) "
                "AND p.puzzle_date >= :start_date AND p.puzzle_date <= :end_date"
            ),
            {"uid": user.id, "start_date": start_date, "end_date": end_date},
        ).fetchall()
        completed_dates.update(row[0] for row in rows if row[1])
        gave_up_dates.update(row[0] for row in rows if row[2])

    guest_session_id = request.cookies.get(GUEST_SESSION_COOKIE)
    if guest_session_id:
        rows = db.execute(
            text(
                "SELECT DISTINCT p.puzzle_date, e.gave_up FROM puzzle_completion_events e "
                "JOIN puzzles p ON e.puzzle_id = p.id "
                "WHERE e.guest_session_id = :guest_session_id "
                "AND p.puzzle_date >= :start_date AND p.puzzle_date <= :end_date"
            ),
            {
                "guest_session_id": guest_session_id,
                "start_date": start_date,
                "end_date": end_date,
            },
        ).fetchall()
        completed_dates.update(row[0] for row in rows if not row[1])
        gave_up_dates.update(row[0] for row in rows if row[1])

    return {
        "completed_dates": sorted(completed_dates),
        "gave_up_dates": sorted(gave_up_dates),
    }


@router.get("")
def get_account(user=Depends(require_user), db: Session = Depends(get_db)):
    stats = _get_stats(user.id, db)
    return AccountResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        stats=stats,
    )


@router.patch("")
@limiter.limit("5/minute")
def update_account(
    request: Request,
    body: UpdateAccountRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    user.display_name = body.display_name.strip()
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, email=user.email, display_name=user.display_name)


@router.delete("")
@limiter.limit("5/minute")
def delete_account(
    request: Request,
    response: Response,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    creator_leagues = db.execute(
        text("SELECT id FROM leagues WHERE creator_id = :uid"), {"uid": user.id}
    ).fetchall()
    for (league_id,) in creator_leagues:
        member_count = db.execute(
            text("SELECT COUNT(*) FROM league_members WHERE league_id = :lid"),
            {"lid": league_id},
        ).scalar()
        if member_count > 1:
            new_creator = db.execute(
                text(
                    "SELECT user_id FROM league_members "
                    "WHERE league_id = :lid AND user_id != :uid "
                    "ORDER BY joined_at ASC LIMIT 1"
                ),
                {"lid": league_id, "uid": user.id},
            ).scalar()
            if new_creator:
                db.execute(
                    text("UPDATE leagues SET creator_id = :nid WHERE id = :lid"),
                    {"nid": new_creator, "lid": league_id},
                )
        else:
            db.execute(
                text("DELETE FROM league_members WHERE league_id = :lid"),
                {"lid": league_id},
            )
            db.execute(text("DELETE FROM leagues WHERE id = :lid"), {"lid": league_id})
    db.execute(
        text("DELETE FROM league_members WHERE user_id = :uid"), {"uid": user.id}
    )
    db.execute(
        text("DELETE FROM auth_tokens WHERE user_id = :uid OR email = :email"),
        {"uid": user.id, "email": user.email},
    )
    db.execute(
        text("DELETE FROM sessions WHERE user_id = :uid"), {"uid": user.id}
    )
    db.execute(
        text("DELETE FROM attempts WHERE user_id = :uid"), {"uid": user.id}
    )
    db.execute(
        text("DELETE FROM puzzle_completion_events WHERE user_id = :uid"),
        {"uid": user.id},
    )
    db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user.id})
    db.commit()

    response.delete_cookie("session")
    return {"message": "Account deleted successfully"}
