import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_user
from ..database import get_db
from ..models import Attempt, Puzzle
from ..puzzle import calculate_score, check_answer, get_puzzle_date
from ..schemas import AttemptRequest, AttemptResponse, HintRequest, HintResponse

router = APIRouter(prefix="/puzzle", tags=["puzzle"])


def _puzzle_to_response(puzzle: Puzzle, include_answer: bool = False) -> dict:
    data = {
        "id": puzzle.id,
        "puzzle_date": puzzle.puzzle_date,
        "puzzle_type": puzzle.puzzle_type,
        "puzzle_name": puzzle.puzzle_name,
        "question": (
            _strip_target(puzzle.question, puzzle.puzzle_type)
            if not include_answer
            else puzzle.question
        ),
        "hint": puzzle.hint if puzzle.hint else None,
        "has_hint": bool(puzzle.hint),
    }
    if include_answer:
        data["answer"] = puzzle.answer
    return data


def _strip_target(question: str, puzzle_type: str) -> str:
    """Remove 'target' from image-tap JSON before sending to client."""
    if puzzle_type != "image-tap":
        return question
    try:
        data = json.loads(question)
        data.pop("target", None)
        return json.dumps(data)
    except (json.JSONDecodeError, AttributeError):
        return question


def _get_puzzle_number(puzzle: Puzzle, db: Session) -> int:
    from sqlalchemy import text

    result = db.execute(
        text("SELECT COUNT(*) FROM puzzles WHERE puzzle_date <= :d"),
        {"d": puzzle.puzzle_date},
    ).scalar()
    return result or 0


def _get_streak(user_id: int, db: Session) -> int:
    rows = db.execute(
        text(
            "SELECT DISTINCT p.puzzle_date FROM attempts a "
            "JOIN puzzles p ON a.puzzle_id = p.id "
            "WHERE a.user_id = :uid AND a.solved = 1 "
            "ORDER BY p.puzzle_date DESC"
        ),
        {"uid": user_id},
    ).fetchall()
    streak = 0
    today = date.today()
    expected = None
    for (d,) in rows:
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
    return streak


def _ensure_attempt(user_id: int, puzzle_id: int, db: Session) -> Attempt:
    attempt = (
        db.query(Attempt)
        .filter(
            Attempt.user_id == user_id,
            Attempt.puzzle_id == puzzle_id,
        )
        .first()
    )
    if not attempt:
        attempt = Attempt(user_id=user_id, puzzle_id=puzzle_id)
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    return attempt


@router.get("/today")
def today(user=Depends(get_current_user), db: Session = Depends(get_db)):
    puzzle_date = get_puzzle_date()
    puzzle = db.query(Puzzle).filter(Puzzle.puzzle_date == puzzle_date).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle today")

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
                data["question"] = puzzle.question  # restore target for solved
    return data


@router.post("/attempt")
def submit_attempt(
    body: AttemptRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == body.puzzle_id,
            Puzzle.puzzle_date == puzzle_date,
        )
        .first()
    )
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    if not user:
        correct = check_answer(body.guess, puzzle.answer)
        if correct:
            now = datetime.now(timezone.utc)
            score = calculate_score(puzzle.puzzle_date, now, 0, False)
            return AttemptResponse(
                correct=True,
                score=score,
                incorrect_guesses=0,
                solved=True,
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
            streak=_get_streak(user.id, db),
        )

    correct = check_answer(body.guess, puzzle.answer)

    if correct:
        now = datetime.now(timezone.utc)
        score = calculate_score(
            puzzle.puzzle_date, now, attempt.incorrect_guesses, bool(attempt.hint_used)
        )
        attempt.solved = 1
        attempt.score = score
        attempt.completed_at = now
        db.commit()
        streak = _get_streak(user.id, db)
        return AttemptResponse(
            correct=True,
            score=score,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            streak=streak,
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


@router.post("/hint")
def reveal_hint(
    body: HintRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    puzzle_date = get_puzzle_date()
    puzzle = (
        db.query(Puzzle)
        .filter(
            Puzzle.id == body.puzzle_id,
            Puzzle.puzzle_date == puzzle_date,
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


@router.get("/result")
def result(user=Depends(require_user), db: Session = Depends(get_db)):
    puzzle_date = get_puzzle_date()
    puzzle = db.query(Puzzle).filter(Puzzle.puzzle_date == puzzle_date).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="No puzzle today")

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
