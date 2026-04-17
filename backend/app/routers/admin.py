from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Attempt, Puzzle, User
from ..puzzle_validation import validate_puzzle
from ..schemas import CreatePuzzleRequest, PuzzleAdminResponse, UpdateAttemptRequest, UpdatePuzzleRequest

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
        has_hint=bool(puzzle.hint),
    )


@router.get("/attempts")
def list_attempts(admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(Attempt, User, Puzzle)
        .join(User, Attempt.user_id == User.id)
        .join(Puzzle, Attempt.puzzle_id == Puzzle.id)
        .order_by(Attempt.id.desc())
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
            "score": attempt.score,
            "incorrect_guesses": attempt.incorrect_guesses,
            "hint_used": bool(attempt.hint_used),
        }
        for attempt, user, puzzle in rows
    ]


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)):
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
        "score": attempt.score,
        "incorrect_guesses": attempt.incorrect_guesses,
        "hint_used": bool(attempt.hint_used),
    }


@router.get("/users")
def list_users(admin=Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/stats")
def get_stats(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "puzzles": db.query(Puzzle).count(),
        "players": db.query(User).count(),
        "attempts": db.query(Attempt).count(),
    }


@router.get("/puzzles")
def list_puzzles(admin=Depends(require_admin), db: Session = Depends(get_db)):
    puzzles = db.query(Puzzle).order_by(Puzzle.puzzle_date.asc()).all()
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

    effective_type = body.puzzle_type if body.puzzle_type is not None else puzzle.puzzle_type
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
