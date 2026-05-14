import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

_LONDON = ZoneInfo("Europe/London")

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_or_create_guest_session_id, require_user
from ..database import get_db
from ..models import Attempt, Puzzle, PuzzleCompletionEvent
from ..puzzle import calculate_score, check_answer, get_puzzle_date
from ..schemas import AttemptRequest, AttemptResponse, HintRequest, HintResponse

router = APIRouter(prefix="/puzzle", tags=["puzzle"])
limiter = Limiter(key_func=get_remote_address)


def _puzzle_to_response(puzzle: Puzzle, include_answer: bool = False) -> dict:
    items = _hint_items(puzzle.puzzle_type, puzzle.question, puzzle.hint)
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
        "has_hint": bool(items),
        "total_hints": len(items),
    }
    if include_answer:
        data["answer"] = puzzle.answer
        data["explanation"] = puzzle.explanation
    return data


def _strip_sensitive(question: str, puzzle_type: str) -> str:
    """Remove sensitive fields from puzzle JSON before sending to client."""
    if puzzle_type not in ("image-tap", "connections", "clue-reveal"):
        return question
    try:
        data = json.loads(question)
        if puzzle_type == "image-tap":
            data.pop("target", None)
        elif puzzle_type == "connections":
            data.pop("categories", None)
        elif puzzle_type == "clue-reveal":
            clues = data.get("clues", [])
            if len(clues) > 1:
                data["clues"] = clues[:1]
        return json.dumps(data)
    except (json.JSONDecodeError, AttributeError):
        return question


def _hint_items(puzzle_type: str, question: str, hint: str | None) -> list[str]:
    """Return the ordered list of hintable items for a puzzle type."""
    try:
        if puzzle_type == "connections":
            return json.loads(question).get("categories", [])
        if puzzle_type == "clue-reveal":
            return json.loads(question).get("clues", [])[1:]
    except (json.JSONDecodeError, AttributeError):
        pass
    return [hint] if hint else []


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
            "WHERE a.user_id = :uid AND a.solved = 1 AND a.source = 'daily' "
            "ORDER BY p.puzzle_date DESC "
            "LIMIT 365"
        ),
        {"uid": user_id},
    ).fetchall()
    streak = 0
    today = datetime.now(_LONDON).date()
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


def _seconds_between(start: datetime | None, end: datetime | None) -> int | None:
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    delta = int((end - start).total_seconds())
    return max(0, delta)


@router.get("/today")
@limiter.limit("60/minute")
def today(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
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
            data["explanation"] = puzzle.explanation
        elif attempt.hint_used > 0:
            items = _hint_items(puzzle.puzzle_type, puzzle.question, puzzle.hint)
            revealed = items[:attempt.hint_used]
            if revealed:
                data["revealed_hint"] = "|".join(revealed)
    return data


@router.post("/attempt")
@limiter.limit("10/minute")
def submit_attempt(
    request: Request,
    response: Response,
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
            score = calculate_score(
                body.opened_at, now, body.incorrect_guesses, body.hints_used
            )
            guest_session_id = get_or_create_guest_session_id(request, response)
            db.add(
                PuzzleCompletionEvent(
                    puzzle_id=puzzle.id,
                    guest_session_id=guest_session_id,
                    completed_at=now,
                    source="daily",
                    wrong_guess_count=None,
                    time_to_complete_seconds=_seconds_between(body.opened_at, now),
                )
            )
            db.commit()
            return AttemptResponse(
                correct=True,
                score=score,
                incorrect_guesses=0,
                solved=True,
                answer=puzzle.answer,
                question=puzzle.question,
                explanation=puzzle.explanation,
            )
        return AttemptResponse(
            correct=False, score=None, incorrect_guesses=0, solved=False
        )

    attempt = _ensure_attempt(user.id, puzzle.id, db)

    if attempt.solved:
        now = datetime.now(timezone.utc)
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=user.id,
                completed_at=now,
                source="daily",
                wrong_guess_count=attempt.incorrect_guesses,
                time_to_complete_seconds=_seconds_between(
                    attempt.opened_at, attempt.completed_at or now
                ),
            )
        )
        db.commit()
        return AttemptResponse(
            correct=True,
            score=attempt.score,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            question=puzzle.question,
            explanation=puzzle.explanation,
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
        attempt.source = "daily"
        attempt.completed_at = now
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=user.id,
                completed_at=now,
                source="daily",
                wrong_guess_count=attempt.incorrect_guesses,
                time_to_complete_seconds=_seconds_between(attempt.opened_at, now),
            )
        )
        db.commit()
        streak = _get_streak(user.id, db)
        return AttemptResponse(
            correct=True,
            score=score,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            question=puzzle.question,
            explanation=puzzle.explanation,
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
    if not puzzle:
        raise HTTPException(status_code=404, detail="No hint available")

    items = _hint_items(puzzle.puzzle_type, puzzle.question, puzzle.hint)
    total_hints = len(items)

    if total_hints == 0:
        raise HTTPException(status_code=404, detail="No hint available")

    if user:
        attempt = _ensure_attempt(user.id, puzzle.id, db)
        idx = attempt.hint_used
        if idx >= total_hints:
            raise HTTPException(status_code=404, detail="No more hints available")
        attempt.hint_used += 1
        db.commit()
        hint_text = items[idx]
    else:
        hint_text = items[0]

    return HintResponse(hint=hint_text, total_hints=total_hints)


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
    puzzle_data["explanation"] = puzzle.explanation
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
