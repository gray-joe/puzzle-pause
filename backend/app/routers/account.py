from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import require_user
from ..database import get_db
from ..schemas import (
    AccountResponse,
    AccountStatsResponse,
    UpdateAccountRequest,
    UserResponse,
)

router = APIRouter(prefix="/account", tags=["account"])


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
        percentile = int(
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
            "WHERE a.user_id = :uid AND a.solved = 1 "
            "ORDER BY p.puzzle_date DESC"
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
def update_account(
    body: UpdateAccountRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    user.display_name = body.display_name.strip()
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, email=user.email, display_name=user.display_name)
