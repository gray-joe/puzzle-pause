from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Attempt, Puzzle, PuzzleCompletionEvent, User
from ..puzzle_validation import validate_puzzle
from ..schemas import (
    CreatePuzzleRequest,
    PuzzleAdminResponse,
    UpdateAttemptRequest,
    UpdatePuzzleRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_TYPES = {
    "word",
    "math",
    "ladder",
    "choice",
    "wordsearch",
    "order",
    "match",
    "connections",
    "image-tap",
    "image-order",
    "image-word",
    "numgrid",
    "scrabble",
    "word-wheel",
    "countdown",
    "clue-reveal",
    "chess",
}


def _to_admin_response(puzzle: Puzzle) -> PuzzleAdminResponse:
    return PuzzleAdminResponse(
        id=puzzle.id,
        puzzle_date=puzzle.puzzle_date,
        puzzle_type=puzzle.puzzle_type,
        puzzle_name=puzzle.puzzle_name,
        question=puzzle.question,
        answer=puzzle.answer,
        hint=puzzle.hint,
        explanation=puzzle.explanation,
        has_hint=bool(puzzle.hint),
    )


@router.get("/attempts")
def list_attempts(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    rows = (
        db.query(Attempt, User, Puzzle)
        .join(User, Attempt.user_id == User.id)
        .join(Puzzle, Attempt.puzzle_id == Puzzle.id)
        .order_by(Attempt.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [
        {
            "id": attempt.id,
            "user_id": user.id,
            "user_email": user.email,
            "user_display_name": user.display_name,
            "puzzle_id": puzzle.id,
            "puzzle_date": puzzle.puzzle_date,
            "puzzle_name": puzzle.puzzle_name,
            "puzzle_type": puzzle.puzzle_type,
            "opened_at": attempt.opened_at,
            "completed_at": attempt.completed_at,
            "solved": bool(attempt.solved),
            "gave_up": bool(attempt.gave_up),
            "score": attempt.score,
            "incorrect_guesses": attempt.incorrect_guesses,
            "hint_used": bool(attempt.hint_used),
        }
        for attempt, user, puzzle in rows
    ]


@router.get("/attempts/{attempt_id}")
def get_attempt(
    attempt_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)
):
    row = (
        db.query(Attempt, User, Puzzle)
        .join(User, Attempt.user_id == User.id)
        .join(Puzzle, Attempt.puzzle_id == Puzzle.id)
        .filter(Attempt.id == attempt_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt, user, puzzle = row
    return {
        "id": attempt.id,
        "user_id": user.id,
        "user_email": user.email,
        "user_display_name": user.display_name,
        "puzzle_id": puzzle.id,
        "puzzle_date": puzzle.puzzle_date,
        "puzzle_name": puzzle.puzzle_name,
        "puzzle_type": puzzle.puzzle_type,
        "opened_at": attempt.opened_at,
        "completed_at": attempt.completed_at,
        "solved": bool(attempt.solved),
        "gave_up": bool(attempt.gave_up),
        "score": attempt.score,
        "incorrect_guesses": attempt.incorrect_guesses,
        "hint_used": bool(attempt.hint_used),
    }


@router.put("/attempts/{attempt_id}")
def update_attempt(
    attempt_id: int,
    body: UpdateAttemptRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Attempt, User, Puzzle)
        .join(User, Attempt.user_id == User.id)
        .join(Puzzle, Attempt.puzzle_id == Puzzle.id)
        .filter(Attempt.id == attempt_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt, user, puzzle = row

    fields = body.model_fields_set
    if "solved" in fields and body.solved is not None:
        attempt.solved = int(body.solved)
    if "score" in fields:
        attempt.score = body.score
    if "incorrect_guesses" in fields and body.incorrect_guesses is not None:
        attempt.incorrect_guesses = body.incorrect_guesses
    if "hint_used" in fields and body.hint_used is not None:
        attempt.hint_used = int(body.hint_used)
    if "opened_at" in fields:
        attempt.opened_at = body.opened_at
    if "completed_at" in fields:
        attempt.completed_at = body.completed_at

    db.commit()
    db.refresh(attempt)
    return {
        "id": attempt.id,
        "user_id": user.id,
        "user_email": user.email,
        "user_display_name": user.display_name,
        "puzzle_id": puzzle.id,
        "puzzle_date": puzzle.puzzle_date,
        "puzzle_name": puzzle.puzzle_name,
        "puzzle_type": puzzle.puzzle_type,
        "opened_at": attempt.opened_at,
        "completed_at": attempt.completed_at,
        "solved": bool(attempt.solved),
        "gave_up": bool(attempt.gave_up),
        "score": attempt.score,
        "incorrect_guesses": attempt.incorrect_guesses,
        "hint_used": bool(attempt.hint_used),
    }


@router.get("/users")
def list_users(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    users = db.query(User).order_by(User.id.desc()).limit(limit).offset(offset).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/completion-events")
def list_completion_events(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
    source: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    puzzle_type: str | None = Query(default=None),
    completed_from: str | None = Query(default=None),
    completed_to: str | None = Query(default=None),
    limit: int = Query(default=250, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    if source is not None and source not in {"daily", "archive"}:
        raise HTTPException(status_code=400, detail="Invalid source filter")
    if actor is not None and actor not in {"guest", "auth"}:
        raise HTTPException(status_code=400, detail="Invalid actor filter")

    from_day: date | None = None
    to_day: date | None = None
    if completed_from is not None:
        try:
            from_day = date.fromisoformat(completed_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid completed_from filter")
    if completed_to is not None:
        try:
            to_day = date.fromisoformat(completed_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid completed_to filter")

    query = (
        db.query(PuzzleCompletionEvent, Puzzle, User)
        .join(Puzzle, PuzzleCompletionEvent.puzzle_id == Puzzle.id)
        .outerjoin(User, PuzzleCompletionEvent.user_id == User.id)
    )

    if source:
        query = query.filter(PuzzleCompletionEvent.source == source)
    if actor == "guest":
        query = query.filter(PuzzleCompletionEvent.user_id.is_(None))
    elif actor == "auth":
        query = query.filter(PuzzleCompletionEvent.user_id.isnot(None))
    if puzzle_type:
        query = query.filter(Puzzle.puzzle_type == puzzle_type)
    if from_day:
        from_dt = datetime.combine(from_day, time.min)
        query = query.filter(PuzzleCompletionEvent.completed_at >= from_dt)
    if to_day:
        to_dt = datetime.combine(to_day + timedelta(days=1), time.min)
        query = query.filter(PuzzleCompletionEvent.completed_at < to_dt)

    rows = (
        query.order_by(PuzzleCompletionEvent.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [
        {
            "id": event.id,
            "puzzle_id": puzzle.id,
            "puzzle_date": puzzle.puzzle_date,
            "puzzle_name": puzzle.puzzle_name,
            "puzzle_type": puzzle.puzzle_type,
            "user_id": user.id if user else None,
            "user_email": user.email if user else None,
            "user_display_name": user.display_name if user else None,
            "guest_session_id": event.guest_session_id,
            "source": event.source,
            "gave_up": bool(event.gave_up),
            "completed_at": event.completed_at,
            "wrong_guess_count": event.wrong_guess_count,
            "time_to_complete_seconds": event.time_to_complete_seconds,
        }
        for event, puzzle, user in rows
    ]


@router.get("/stats")
def get_stats(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "puzzles": db.query(Puzzle).count(),
        "players": db.query(User).count(),
        "attempts": db.query(Attempt).count(),
        "completion_events": db.query(PuzzleCompletionEvent).count(),
        "guest_completion_events": db.query(PuzzleCompletionEvent)
        .filter(PuzzleCompletionEvent.user_id.is_(None))
        .count(),
        "auth_completion_events": db.query(PuzzleCompletionEvent)
        .filter(PuzzleCompletionEvent.user_id.isnot(None))
        .count(),
    }


@router.get("/puzzles")
def list_puzzles(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    puzzles = (
        db.query(Puzzle)
        .order_by(Puzzle.puzzle_date.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [_to_admin_response(p) for p in puzzles]


@router.post("/puzzles", status_code=status.HTTP_201_CREATED)
def create_puzzle(
    body: CreatePuzzleRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.puzzle_type not in VALID_TYPES:
        raise HTTPException(
            status_code=400, detail=f"Invalid puzzle_type: {body.puzzle_type}"
        )

    try:
        validate_puzzle(body.puzzle_type, body.question, body.answer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = db.query(Puzzle).filter(Puzzle.puzzle_date == body.puzzle_date).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="A puzzle already exists for this date"
        )

    puzzle = Puzzle(
        puzzle_date=body.puzzle_date,
        puzzle_type=body.puzzle_type,
        puzzle_name=body.puzzle_name,
        question=body.question,
        answer=body.answer,
        hint=body.hint or None,
        explanation=body.explanation or None,
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return _to_admin_response(puzzle)


@router.get("/puzzles/{puzzle_id}")
def get_puzzle(
    puzzle_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)
):
    puzzle = db.query(Puzzle).filter(Puzzle.id == puzzle_id).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return _to_admin_response(puzzle)


@router.put("/puzzles/{puzzle_id}")
def update_puzzle(
    puzzle_id: int,
    body: UpdatePuzzleRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    puzzle = db.query(Puzzle).filter(Puzzle.id == puzzle_id).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    if body.puzzle_type is not None and body.puzzle_type not in VALID_TYPES:
        raise HTTPException(
            status_code=400, detail=f"Invalid puzzle_type: {body.puzzle_type}"
        )

    effective_type = (
        body.puzzle_type if body.puzzle_type is not None else puzzle.puzzle_type
    )
    effective_question = body.question if body.question is not None else puzzle.question
    effective_answer = body.answer if body.answer is not None else puzzle.answer
    try:
        validate_puzzle(effective_type, effective_question, effective_answer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if body.puzzle_date is not None:
        puzzle.puzzle_date = body.puzzle_date
    if body.puzzle_type is not None:
        puzzle.puzzle_type = body.puzzle_type
    if body.puzzle_name is not None:
        puzzle.puzzle_name = body.puzzle_name
    if body.question is not None:
        puzzle.question = body.question
    if body.answer is not None:
        puzzle.answer = body.answer
    if body.hint is not None:
        puzzle.hint = body.hint or None
    if "explanation" in body.model_fields_set:
        puzzle.explanation = body.explanation or None

    db.commit()
    db.refresh(puzzle)
    return _to_admin_response(puzzle)


@router.delete("/puzzles/{puzzle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_puzzle(
    puzzle_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)
):
    puzzle = db.query(Puzzle).filter(Puzzle.id == puzzle_id).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    db.delete(puzzle)
    db.commit()
