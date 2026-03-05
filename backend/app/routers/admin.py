from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Puzzle
from ..schemas import CreatePuzzleRequest, PuzzleAdminResponse, UpdatePuzzleRequest

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
