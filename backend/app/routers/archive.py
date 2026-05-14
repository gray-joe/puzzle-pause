from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_or_create_guest_session_id, require_user
from ..database import get_db
from ..models import Attempt, Puzzle, PuzzleCompletionEvent
from ..puzzle import calculate_archive_score, check_answer, get_puzzle_date
from ..routers.puzzle import _ensure_attempt, _get_puzzle_number, _hint_items, _puzzle_to_response
from ..schemas import AttemptRequest, AttemptResponse, HintResponse

router = APIRouter(prefix="/archive", tags=["archive"])
limiter = Limiter(key_func=get_remote_address)


def _seconds_between(start: datetime | None, end: datetime | None) -> int | None:
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    delta = int((end - start).total_seconds())
    return max(0, delta)


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
                "opened_at": (
                    attempt.opened_at.isoformat() if attempt.opened_at else None
                ),
            }
            if attempt.solved:
                data["question"] = puzzle.question
                data["answer"] = puzzle.answer
                data["explanation"] = puzzle.explanation

    return data


@router.post("/{puzzle_id}/attempt")
@limiter.limit("10/minute")
def archive_attempt(
    request: Request,
    response: Response,
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
            now = datetime.now(timezone.utc)
            score = calculate_archive_score(
                body.opened_at, now, body.incorrect_guesses, body.hints_used
            )
            guest_session_id = get_or_create_guest_session_id(request, response)
            db.add(
                PuzzleCompletionEvent(
                    puzzle_id=puzzle.id,
                    guest_session_id=guest_session_id,
                    completed_at=now,
                    source="archive",
                    wrong_guess_count=body.incorrect_guesses,
                    time_to_complete_seconds=_seconds_between(body.opened_at, now),
                )
            )
            db.commit()
            return AttemptResponse(
                correct=True,
                score=score,
                incorrect_guesses=body.incorrect_guesses,
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
                source="archive",
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
        )

    correct = check_answer(body.guess, puzzle.answer)

    if correct:
        now = datetime.now(timezone.utc)
        score = calculate_archive_score(
            attempt.opened_at, now, attempt.incorrect_guesses, attempt.hint_used
        )
        attempt.solved = 1
        attempt.score = score
        attempt.source = "archive"
        attempt.completed_at = now
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=user.id,
                completed_at=now,
                source="archive",
                wrong_guess_count=attempt.incorrect_guesses,
                time_to_complete_seconds=_seconds_between(attempt.opened_at, now),
            )
        )
        db.commit()
        return AttemptResponse(
            correct=True,
            score=score,
            incorrect_guesses=attempt.incorrect_guesses,
            solved=True,
            answer=puzzle.answer,
            question=puzzle.question,
            explanation=puzzle.explanation,
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
