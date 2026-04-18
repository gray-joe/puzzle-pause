from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_user
from ..database import get_db
from ..models import Attempt, Puzzle
from ..puzzle import check_answer, get_puzzle_date
from ..routers.puzzle import _ensure_attempt, _get_puzzle_number, _puzzle_to_response
from ..schemas import AttemptRequest, AttemptResponse, HintResponse

router = APIRouter(prefix="/archive", tags=["archive"])
limiter = Limiter(key_func=get_remote_address)


@router.get("")
@limiter.limit("30/minute")
def list_archive(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    puzzle_date = get_puzzle_date()

    if user:
        rows = db.execute(
            text(
                "SELECT p.id, p.puzzle_date, p.puzzle_type, p.puzzle_name, p.hint, "
                "  ROW_NUMBER() OVER (ORDER BY p.puzzle_date ASC) AS puzzle_number, "
                "  CASE WHEN a.solved = 1 THEN 1 ELSE 0 END AS solved "
                "FROM puzzles p "
                "LEFT JOIN attempts a ON a.puzzle_id = p.id AND a.user_id = :uid "
                "WHERE p.puzzle_date < :today "
                "ORDER BY p.puzzle_date DESC "
                "LIMIT :limit OFFSET :offset"
            ),
            {"uid": user.id, "today": puzzle_date, "limit": limit, "offset": offset},
        ).fetchall()
    else:
        rows = db.execute(
            text(
                "SELECT p.id, p.puzzle_date, p.puzzle_type, p.puzzle_name, p.hint, "
                "  ROW_NUMBER() OVER (ORDER BY p.puzzle_date ASC) AS puzzle_number, "
                "  NULL AS solved "
                "FROM puzzles p "
                "WHERE p.puzzle_date < :today "
                "ORDER BY p.puzzle_date DESC "
                "LIMIT :limit OFFSET :offset"
            ),
            {"today": puzzle_date, "limit": limit, "offset": offset},
        ).fetchall()

    return [
        {
            "id": row[0],
            "puzzle_date": row[1],
            "puzzle_type": row[2],
            "puzzle_name": row[3],
            "hint": row[4],
            "has_hint": bool(row[4]),
            "puzzle_number": row[5],
            "solved": bool(row[6]) if row[6] is not None else None,
        }
        for row in rows
    ]


@router.get("/{puzzle_id}")
@limiter.limit("60/minute")
def get_archive_puzzle(
    request: Request, puzzle_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == puzzle_id,
            Puzzle.puzzle_date < puzzle_date,
        )
        .first()
    )
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    data = _puzzle_to_response(puzzle)
    data["puzzle_number"] = _get_puzzle_number(puzzle, db)

    if user:
        attempt = (
            db.query(Attempt)
            .filter(
                Attempt.user_id == user.id,
                Attempt.puzzle_id == puzzle.id,
            )
            .first()
        )
        if attempt:
            data["solved"] = bool(attempt.solved)
            data["attempt"] = {
                "solved": bool(attempt.solved),
                "score": attempt.score,
                "incorrect_guesses": attempt.incorrect_guesses,
                "hint_used": bool(attempt.hint_used),
                "completed_at": (
                    attempt.completed_at.isoformat() if attempt.completed_at else None
                ),
            }
            if attempt.solved:
                data["question"] = puzzle.question
                data["answer"] = puzzle.answer

    return data


@router.post("/{puzzle_id}/attempt")
@limiter.limit("10/minute")
def archive_attempt(
    request: Request,
    puzzle_id: int,
    body: AttemptRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == puzzle_id,
            Puzzle.puzzle_date < puzzle_date,
        )
        .first()
    )
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    # Guest flow: check answer without persisting
    if not user:
        correct = check_answer(body.guess, puzzle.answer)
        if correct:
            return AttemptResponse(
                correct=True, score=0, incorrect_guesses=0, solved=True,
                answer=puzzle.answer, question=puzzle.question,
            )
        return AttemptResponse(
            correct=False, score=None, incorrect_guesses=0, solved=False
        )

    attempt = _ensure_attempt(user.id, puzzle.id, db)

    if attempt.solved:
        return AttemptResponse(
            correct=True,
            score=attempt.score,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            question=puzzle.question,
        )

    correct = check_answer(body.guess, puzzle.answer)

    if correct:
        attempt.solved = 1
        attempt.score = 0
        attempt.completed_at = datetime.now(timezone.utc)
        db.commit()
        return AttemptResponse(
            correct=True,
            score=0,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            question=puzzle.question,
        )
    else:
        attempt.incorrect_guesses += 1
        db.commit()
        return AttemptResponse(
            correct=False,
            score=None,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=False,
        )


@router.post("/{puzzle_id}/hint")
@limiter.limit("5/minute")
def archive_hint(
    request: Request, puzzle_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == puzzle_id,
            Puzzle.puzzle_date < puzzle_date,
        )
        .first()
    )
    if not puzzle or not puzzle.hint:
        raise HTTPException(status_code=404, detail="No hint available")

    if user:
        attempt = _ensure_attempt(user.id, puzzle.id, db)
        if not attempt.hint_used:
            attempt.hint_used = 1
            db.commit()

    return HintResponse(hint=puzzle.hint)


@router.get("/{puzzle_id}/result")
def archive_result(
    puzzle_id: int, user=Depends(require_user), db: Session = Depends(get_db)
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == puzzle_id,
            Puzzle.puzzle_date < puzzle_date,
        )
        .first()
    )
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    attempt = (
        db.query(Attempt)
        .filter(
            Attempt.user_id == user.id,
            Attempt.puzzle_id == puzzle.id,
            Attempt.solved == 1,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Not solved yet")

    puzzle_data = _puzzle_to_response(puzzle)
    puzzle_data["puzzle_number"] = _get_puzzle_number(puzzle, db)

    return {
        "puzzle": puzzle_data,
        "attempt": {
            "solved": True,
            "score": attempt.score,
            "incorrect_guesses": attempt.incorrect_guesses,
            "hint_used": bool(attempt.hint_used),
            "completed_at": (
                attempt.completed_at.isoformat() if attempt.completed_at else None
            ),
        },
    }
