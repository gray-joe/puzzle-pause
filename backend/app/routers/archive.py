from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_user
from ..database import get_db
from ..models import Attempt, Puzzle
from ..puzzle import check_answer, get_puzzle_date
from ..routers.puzzle import _ensure_attempt, _get_puzzle_number, _puzzle_to_response
from ..schemas import AttemptRequest, AttemptResponse, HintResponse

router = APIRouter(prefix="/archive", tags=["archive"])


@router.get("")
def list_archive(user=Depends(get_current_user), db: Session = Depends(get_db)):
    puzzle_date = get_puzzle_date()
    puzzles = (
        db.query(Puzzle)
        .filter(Puzzle.puzzle_date < puzzle_date)
        .order_by(Puzzle.puzzle_date.desc())
        .all()
    )

    result = []
    for p in puzzles:
        data = _puzzle_to_response(p)
        data["puzzle_number"] = _get_puzzle_number(p, db)
        if user:
            attempt = (
                db.query(Attempt)
                .filter(
                    Attempt.user_id == user.id,
                    Attempt.puzzle_id == p.id,
                )
                .first()
            )
            data["solved"] = bool(attempt and attempt.solved) if attempt else False
        else:
            data["solved"] = None
        result.append(data)

    return result


@router.get("/{puzzle_id}")
def get_archive_puzzle(
    puzzle_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)
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

    return data


@router.post("/{puzzle_id}/attempt")
def archive_attempt(
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
                answer=puzzle.answer,
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
def archive_hint(
    puzzle_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)
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
