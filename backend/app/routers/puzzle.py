import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_user
from ..database import get_db
from ..models import Attempt, Puzzle
from ..puzzle import calculate_score, check_answer, get_puzzle_date
from ..schemas import AttemptRequest, AttemptResponse, HintRequest, HintResponse

router = APIRouter(prefix="/puzzle", tags=["puzzle"])
limiter = Limiter(key_func=get_remote_address)


def _puzzle_to_response(puzzle: Puzzle, include_answer: bool = False) -> dict:
    data = {
        "id": puzzle.id,
        "puzzle_date": puzzle.puzzle_date,
        "puzzle_type": puzzle.puzzle_type,
        "puzzle_name": puzzle.puzzle_name,
        "question": (
            _strip_sensitive(puzzle.question, puzzle.puzzle_type)
            if not include_answer
            else puzzle.question
        ),
        "hint": puzzle.hint if puzzle.hint else None,
        "has_hint": bool(puzzle.hint) or puzzle.puzzle_type == "connections",
    }
    if include_answer:
        data["answer"] = puzzle.answer
    return data


def _strip_sensitive(question: str, puzzle_type: str) -> str:
    """Remove sensitive fields from puzzle JSON before sending to client."""
    if puzzle_type not in ("image-tap", "connections"):
        return question
    try:
        data = json.loads(question)
        if puzzle_type == "image-tap":
            data.pop("target", None)
        elif puzzle_type == "connections":
            data.pop("categories", None)
        return json.dumps(data)
    except (json.JSONDecodeError, AttributeError):
        return question


def _connections_hint(question: str) -> str | None:
    """Extract categories from a connections question JSON as the hint."""
    try:
        data = json.loads(question)
        categories = data.get("categories")
        if categories:
            return "|".join(categories)
    except (json.JSONDecodeError, AttributeError):
        pass
    return None


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
            "WHERE a.user_id = :uid AND a.solved = 1 AND a.score > 0 "
            "ORDER BY p.puzzle_date DESC "
            "LIMIT 365"
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
        attempt = Attempt(
            user_id=user_id, puzzle_id=puzzle_id, opened_at=datetime.now(timezone.utc)
        )
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
        attempt = _ensure_attempt(user.id, puzzle.id, db)
        data["attempt"] = {
            "solved": bool(attempt.solved),
            "score": attempt.score,
            "incorrect_guesses": attempt.incorrect_guesses,
            "hint_used": bool(attempt.hint_used),
            "completed_at": (
                attempt.completed_at.isoformat() if attempt.completed_at else None
            ),
            "opened_at": (
                attempt.opened_at.isoformat() if attempt.opened_at else None
            ),
        }
        if attempt.solved:
            data["question"] = puzzle.question
            data["answer"] = puzzle.answer
    return data


@router.post("/attempt")
@limiter.limit("10/minute")
def submit_attempt(
    request: Request,
    body: AttemptRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
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
            score = calculate_score(body.opened_at, now, 0, 0)
            return AttemptResponse(
                correct=True,
                score=score,
                incorrect_guesses=0,
                solved=True,
                answer=puzzle.answer,
                question=puzzle.question,
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
            streak=_get_streak(user.id, db),
        )

    correct = check_answer(body.guess, puzzle.answer)

    if correct:
        now = datetime.now(timezone.utc)
        score = calculate_score(
            attempt.opened_at, now, attempt.incorrect_guesses, attempt.hint_used
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
            question=puzzle.question,
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
@limiter.limit("5/minute")
def reveal_hint(
    request: Request,
    body: HintRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
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
    if puzzle and puzzle.puzzle_type == "connections":
        hint_text = _connections_hint(puzzle.question)
    else:
        hint_text = puzzle.hint if puzzle else None

    if not puzzle or not hint_text:
        raise HTTPException(status_code=404, detail="No hint available")

    if user:
        attempt = _ensure_attempt(user.id, puzzle.id, db)
        attempt.hint_used += 1
        db.commit()

    return HintResponse(hint=hint_text)


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
            "opened_at": (
                attempt.opened_at.isoformat() if attempt.opened_at else None
            ),
        },
    }
