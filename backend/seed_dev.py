"""
Seed the development database with test data.

Requires DATABASE_URL env var.

Usage: DATABASE_URL=sqlite:///path/to/puzzle.db python seed_dev.py
"""

from datetime import datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
from app.models import Attempt, League, LeagueMember, Puzzle, User
from app.puzzle import get_puzzle_date


def _date(days_ago: int) -> str:
    """Return a YYYY-MM-DD string for `days_ago` days before today."""
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def _ts(days_ago: int, hour: int, minute: int = 0) -> str:
    """Return an ISO timestamp for a specific time `days_ago` days before today."""
    dt = datetime.now(timezone.utc).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    ) - timedelta(days=days_ago)
    return dt.isoformat()


# Puzzle definitions with relative dates (days_ago).
# Puzzles are ordered oldest to newest.
SEED_PUZZLES = [
    {
        "days_ago": 14,
        "puzzle_type": "math",
        "puzzle_name": "Welcome to Puzzle Pause",
        "question": "How many seconds will it take 8 Puzzle solvers to solve 72 puzzles if they each solve one puzzle every 5 seconds?",
        "answer": "45",
        "hint": "Each puzzle solver has to solve how many puzzles?",
    },
    {
        "days_ago": 13,
        "puzzle_type": "word",
        "puzzle_name": "High five",
        "question": "What word can be placed in front of these 5 words to form 5 new words?<br><br>Dress, Club, Cap, Time, Light",
        "answer": "Night",
        "hint": "It's getting dark",
    },
    {
        "days_ago": 12,
        "puzzle_type": "word",
        "puzzle_name": "Gems",
        "question": "Complete the sequence:<br><br>Ruby, Carnelian, Citrine, _______, Sapphire, Tanzanite, Amethyst",
        "answer": "Emerald",
        "hint": "Rainbow",
    },
    {
        "days_ago": 11,
        "puzzle_type": "word",
        "puzzle_name": "Connections",
        "question": "What is the connection between these clues?<br><br>A German battleship, Mr. Burns, Bellatrix Lestrange, A city south of Hull, Square Garden",
        "answer": "State capitals|US state capitals|Capitals of US states|American state capitals",
        "hint": "Think USA",
    },
    {
        "days_ago": 10,
        "puzzle_type": "ladder",
        "puzzle_name": "Dawn till Dusk",
        "question": "Dawn, ____, Dare, ____, ____, ____, Dusk",
        "answer": "dawn darn dare dark dirk disk dusk",
        "hint": "Damn, Murky, Dagger, Circle",
    },
    {
        "days_ago": 6,
        "puzzle_type": "math",
        "puzzle_name": "Symbol Solver",
        "question": "&alpha;&alpha; + &beta; = 19<br>&beta;&gamma; &minus; &alpha; = 11<br><br>&alpha; + &beta; + &gamma; = ?",
        "answer": "12",
        "hint": "&alpha;&alpha; means &alpha; &times; &alpha;",
    },
    {
        "days_ago": 5,
        "puzzle_type": "word",
        "puzzle_name": "Complete the sequence...",
        "question": "What letter comes next?<br><br>c.adaeibfec_",
        "answer": "e",
        "hint": "pi",
    },
    {
        "days_ago": 4,
        "puzzle_type": "math",
        "puzzle_name": "Strength in Numbers",
        "question": "If one person is considered ERRONEOUS, and two are considered TRUSTWORTHY, how many people does it take to be considered ENLIGHTENING?",
        "answer": "10",
        "hint": "The answers are hidden in plain sight.",
    },
    {
        "days_ago": 3,
        "puzzle_type": "word",
        "puzzle_name": "Happy Valentine's Day!",
        "question": "<style>.t{display:inline-block;border:2px solid #4ecca3;border-radius:4px;padding:5px 10px;margin:2px;font-size:1.2em}</style>In Scrabble, what is the highest scoring word achievable with these letters, and what is the score? e.g. more 6<br><br><span class=t>C</span><span class=t>O</span><span class=t>R</span><span class=t>M</span><span class=t>A</span><span class=t>N</span><span class=t>E</span>",
        "answer": "romance 11",
        "hint": "Use all 7 letters.",
    },
    {
        "days_ago": 2,
        "puzzle_type": "math",
        "puzzle_name": "Simple addition?",
        "question": "If 5+2=7, 5+4=11, 7+6=15, 10+10=20, what is 17+7?",
        "answer": "26",
        "hint": "Octal numbers.",
    },
    {
        "days_ago": 1,
        "puzzle_type": "word",
        "puzzle_name": "Scholar's",
        "question": "1. e4 e5<br>2. Bc4 Nc6<br>3. Qh5 Nf6<br>4. ?",
        "answer": "Qxf7",
        "hint": "White to move and win.",
    },
    {
        "days_ago": -5,
        "puzzle_type": "math",
        "puzzle_name": "Future Puzzle",
        "question": "This puzzle is in the future",
        "answer": "42",
        "hint": "The answer to everything",
    },
]

SEED_USERS = [
    {"email": "test@example.com", "display_name": "Test User"},
    {"email": "alice@example.com", "display_name": "Alice"},
    {"email": "bob@example.com", "display_name": "Bob"},
    {"email": "charlie@example.com", "display_name": "Charlie"},
]


def seed():
    print("Dropping and recreating all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Seed puzzles with relative dates
        puzzle_ids = {}  # days_ago -> puzzle_id
        for p in SEED_PUZZLES:
            days_ago = p.pop("days_ago")
            p["puzzle_date"] = _date(days_ago)
            puzzle = Puzzle(**p)
            db.add(puzzle)
            db.flush()
            puzzle_ids[days_ago] = puzzle.id
        db.flush()

        # Today's puzzle
        today = get_puzzle_date()
        existing = db.query(Puzzle).filter(Puzzle.puzzle_date == today).first()
        if not existing:
            today_puzzle = Puzzle(
                puzzle_date=today,
                puzzle_type="math",
                puzzle_name="Quick Maths",
                question="1+1=?",
                answer="2",
                hint="Count on your fingers",
            )
            db.add(today_puzzle)
            db.flush()
            today_puzzle_id = today_puzzle.id
        else:
            today_puzzle_id = existing.id

        # Seed users
        for u in SEED_USERS:
            db.add(User(**u))
        db.flush()

        # Dev league
        league = League(id=1, name="Dev League", invite_code="DEV001", creator_id=1)
        db.add(league)
        db.flush()

        for user_id in [1, 2, 3, 4]:
            db.add(LeagueMember(league_id=1, user_id=user_id))
        db.flush()

        # Second league (Test User and Alice only)
        league2 = League(id=2, name="Puzzle Pros", invite_code="PRO002", creator_id=1)
        db.add(league2)
        db.flush()

        for user_id in [1, 2]:
            db.add(LeagueMember(league_id=2, user_id=user_id))
        db.flush()

        # Historical attempts (references puzzles by days_ago)
        # Format: (user_id, days_ago, solved, score, guesses, hint, hour, minute)
        attempts = [
            # Test User: solid scores (puzzles from 14-10 days ago)
            (1, 14, 1, 90, 1, 0, 11, 0),
            (1, 13, 1, 85, 0, 0, 11, 30),
            (1, 12, 1, 80, 1, 0, 10, 30),
            (1, 11, 1, 95, 0, 0, 11, 0),
            (1, 10, 1, 75, 2, 0, 11, 0),
            # Test User: recent scores (this week)
            (1, 6, 1, 85, 1, 0, 10, 0),
            (1, 5, 1, 90, 0, 0, 10, 30),
            # Alice: "The Guesser" — lots of wrong guesses
            (2, 14, 1, 60, 3, 0, 12, 0),
            (2, 13, 1, 55, 4, 0, 13, 0),
            (2, 12, 1, 50, 5, 0, 12, 30),
            (2, 11, 1, 65, 2, 0, 12, 0),
            (2, 10, 1, 45, 3, 0, 14, 0),
            # Alice: recent scores (this week)
            (2, 6, 1, 55, 3, 0, 12, 0),
            (2, 5, 1, 50, 4, 0, 13, 0),
            # Bob: "The One Shotter" + "The Early Riser"
            (3, 14, 1, 100, 0, 0, 9, 10),
            (3, 13, 1, 100, 0, 0, 9, 15),
            (3, 12, 1, 100, 0, 0, 9, 20),
            (3, 11, 1, 100, 0, 0, 9, 12),
            (3, 10, 1, 100, 0, 0, 9, 18),
            # Bob: recent scores (this week)
            (3, 6, 1, 100, 0, 0, 9, 5),
            (3, 5, 1, 100, 0, 0, 9, 8),
            # Charlie: "The Hint Lover"
            (4, 14, 1, 70, 0, 1, 10, 0),
            (4, 13, 1, 65, 1, 1, 10, 30),
            (4, 12, 1, 60, 0, 1, 10, 0),
            (4, 11, 1, 75, 0, 1, 10, 15),
            (4, 10, 1, 55, 1, 1, 10, 45),
            # Charlie: recent scores (this week)
            (4, 6, 1, 65, 0, 1, 10, 0),
            (4, 5, 1, 60, 1, 1, 10, 30),
        ]

        for uid, days_ago, solved, score, guesses, hint, hour, minute in attempts:
            pid = puzzle_ids[days_ago]
            db.add(
                Attempt(
                    user_id=uid,
                    puzzle_id=pid,
                    solved=solved,
                    score=score,
                    incorrect_guesses=guesses,
                    hint_used=hint,
                    completed_at=datetime.fromisoformat(
                        _ts(days_ago, hour, minute)
                    ),
                )
            )

        # Bob solves today's puzzle
        db.add(
            Attempt(
                user_id=3,
                puzzle_id=today_puzzle_id,
                solved=1,
                score=95,
                incorrect_guesses=1,
                hint_used=0,
                completed_at=datetime.now(timezone.utc).replace(
                    hour=9, minute=15, second=0, microsecond=0
                ),
            )
        )

        db.commit()

        past_count = sum(1 for p in SEED_PUZZLES if p.get("puzzle_date", "") <= today)
        total = db.query(Puzzle).count()
        print(
            f"Seeded: {total} puzzles, today={today}, 4 users, 2 leagues, {len(attempts) + 1} attempts"
        )
        print("Development database ready!")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
