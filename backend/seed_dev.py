"""
Seed the development database with test data.

Requires DATABASE_URL env var.

Usage: DATABASE_URL=sqlite:///path/to/puzzle.db python seed_dev.py
"""

from datetime import datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
from app.models import (
    Attempt,
    League,
    LeagueMember,
    Puzzle,
    PuzzleCompletionEvent,
    User,
)
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
        "explanation": "The 72 puzzles are shared by 8 solvers, so each solves 9 puzzles. At 5 seconds per puzzle, that takes 45 seconds.",
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
        "answer": "darn, dark, dirk, disk",
        "hint": "Damn, Murky, Dagger, Circle",
    },
    {
        "days_ago": 8,
        "puzzle_type": "numgrid",
        "puzzle_name": "Missing Piece",
        "question": '{"prompt":"What number is missing from this grid?","grid":[1,2,3,4,5,6,7,8,9,10,null,12,13,14,15,16]}',
        "answer": "11",
        "hint": "Count the rows",
    },
    {
        "days_ago": 7,
        "puzzle_type": "match",
        "puzzle_name": "Capital Cities",
        "question": '{"prompt":"Match each country to its capital city:","left":["France","Japan","Brazil","Australia"],"right":["Canberra","Paris","Brasília","Tokyo"]}',
        "answer": "1,3,2,0",
        "hint": "One of these capitals is not the largest city in its country",
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
        "puzzle_type": "scrabble",
        "puzzle_name": "Happy Valentine's Day!",
        "question": '{"prompt":"What is the highest scoring word achievable with these letters, and what is the score? e.g. more 6","board":[null,null,null,null,null,null,null],"modifiers":[null,null,"tl",null,null,"dw",null],"rack":["C","O","R","M","A","N","E"]}',
        "answer": "romance 34",
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
        "days_ago": 0,
        "puzzle_type": "math",
        "puzzle_name": "Quick Maths",
        "question": "1+1=?",
        "answer": "2",
        "hint": "Count on your fingers",
    },
    {
        "days_ago": -4,
        "puzzle_type": "order",
        "puzzle_name": "Solar System",
        "question": '{"prompt":"Put these planets in order from the Sun:","items":["Mars","Venus","Earth","Mercury"]}',
        "answer": "3,1,2,0",
        "hint": "The closest planet is also the smallest",
    },
    {
        "days_ago": -5,
        "puzzle_type": "math",
        "puzzle_name": "Future Puzzle",
        "question": "This puzzle is in the future",
        "answer": "42",
        "hint": "The answer to everything",
    },
    {
        "days_ago": 16,
        "puzzle_type": "choice",
        "puzzle_name": "Solar Giant",
        "question": "Which planet is the largest in our solar system?|Earth|Saturn|Jupiter|Mars",
        "answer": "C",
        "hint": "It also has the most moons",
    },
    {
        "days_ago": 9,
        "puzzle_type": "wordsearch",
        "puzzle_name": "Hidden Words",
        "question": "A B C D E\nF G H I J\nE A R T H\nK L M N O\nP Q R S T\nFind: EARTH",
        "answer": "EARTH",
        "hint": "The third planet from the Sun",
    },
    {
        "days_ago": 15,
        "puzzle_type": "word-wheel",
        "puzzle_name": "Spin to Win",
        "question": '{"prompt":"Find the 8-letter word hidden in each wheel. Letters can be read clockwise or anticlockwise.","wheels":[{"letters":["S","T",null,"R","L","I",null,"G"]},{"letters":[null,"L","I","M",null,"I","N","G"]}]}',
        "answer": "starling climbing",
        "hint": "Both words are activities or things you might do outdoors.",
    },
    {
        "days_ago": 20,
        "puzzle_type": "connections",
        "puzzle_name": "Group Up",
        "question": '{"prompt":"Group these 9 words into 3 categories of 3:","items":["Apple","Banana","Cherry","Carrot","Broccoli","Spinach","Red","Blue","Green"],"categories":["Fruits","Vegetables","Colors"]}',
        "answer": "0,1,2|3,4,5|6,7,8",
        "hint": "One category you can eat raw",
    },
    {
        "days_ago": 21,
        "puzzle_type": "order",
        "puzzle_name": "Alphabetical",
        "question": '{"prompt":"Sort these words into alphabetical order:","items":["Three","One","Two"]}',
        "answer": "1,2,0",
        "hint": "Think of them as numbers",
    },
    {
        "days_ago": 22,
        "puzzle_type": "image-tap",
        "puzzle_name": "Find the Spot",
        "question": '{"prompt":"Click somewhere on the image:","image_url":"/puzzle-image.jpg"}',
        "answer": "0.9999,0.9999",
        "hint": "Try the bottom-right corner",
    },
    {
        "days_ago": 23,
        "puzzle_type": "image-order",
        "puzzle_name": "Sort the Images",
        "question": '{"prompt":"Sort these images into the correct order:","images":["/puzzle-image-1.jpg","/puzzle-image-2.jpg"]}',
        "answer": "0,1",
        "hint": "The first one comes first",
    },
    {
        "days_ago": 24,
        "puzzle_type": "countdown",
        "puzzle_name": "Countdown",
        "question": '{"prompt":"Reach the target using the numbers and operators below:","target":306,"numbers":[75,50,6,3,2,1],"operators":["+","-","×","÷"]}',
        "answer": "306",
        "hint": "50 × 6 is a great start",
    },
    {
        "days_ago": 26,
        "puzzle_type": "clue-reveal",
        "puzzle_name": "Who Am I?",
        "question": '{"prompt":"Who am I?","clues":["I was born in 1564 in Stratford-upon-Avon, England.","I wrote approximately 37 plays and 154 sonnets during my lifetime.","Two of my most famous works are Hamlet and Romeo and Juliet."]}',
        "answer": "William Shakespeare|Shakespeare",
    },
    {
        "days_ago": 25,
        "puzzle_type": "image-word",
        "puzzle_name": "Cube Puzzle",
        "question": '{"prompt":"Which cube cannot be made from the net shown?","image_url":"https://falling-snow-3855.t3.storage.dev/cube_puzzle.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=tid_XOHnXBJLbAfjzvRKvOmwCZCKTUztWEPodnZIDWhGZvGngqMPca%2F20260322%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260322T100720Z&X-Amz-Expires=7776000&X-Amz-SignedHeaders=host&X-Amz-Signature=76f1433d84493d2026e1c59fc3c2c668e9ec9bdc5b86e4c3c15f3e4346a43f47"}',
        "answer": "C",
        "hint": "Think about which faces are opposite each other",
    },
]

SEED_USERS = [
    {"email": "test@example.com", "display_name": "Test User"},
    {"email": "alice@example.com", "display_name": "Alice"},
    {"email": "bob@example.com", "display_name": "Bob"},
    {"email": "charlie@example.com", "display_name": "Charlie"},
    {"email": "edit-name@example.com", "display_name": "EditMe"},
    {"email": "admin@example.com", "display_name": "Admin"},
    {"email": "nonadmin@example.com", "display_name": "NonAdmin"},
    # Reserved for the e2e account-deletion test. Not a member of leagues
    # 1 or 2 so deletion in the test does not affect any other coverage.
    {"email": "delete-account@example.com", "display_name": "Delete Account"},
    {"email": "delete-witness@example.com", "display_name": "Delete Witness"},
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
                puzzle_type="connections",
                puzzle_name="Group Think",
                question='{"prompt":"Group these 12 words into 3 categories of 4:","items":["Cobra","Mamba","Adder","Python","Boa","Viper","Asp","Anaconda","Java","Ruby","Perl","Swift"],"categories":["Venomous snakes","Constrictor snakes","Programming languages"]}',
                answer="0,1,2,5|3,4,6,7|8,9,10,11",
                hint="One category is also a tech term",
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

        # Third league reserved for the e2e account-deletion test.
        # delete-account (user 8) is the creator; delete-witness (user 9) is a
        # co-member so the ownership-transfer path is exercised on deletion.
        league3 = League(
            id=3, name="Delete Test League", invite_code="DEL003", creator_id=8
        )
        db.add(league3)
        db.flush()
        for user_id in [8, 9]:
            db.add(LeagueMember(league_id=3, user_id=user_id))
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
                    completed_at=datetime.fromisoformat(_ts(days_ago, hour, minute)),
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

        completion_events = [
            PuzzleCompletionEvent(
                puzzle_id=puzzle_ids[14],
                user_id=1,
                source="archive",
                completed_at=datetime.fromisoformat(_ts(14, 11, 1)),
                wrong_guess_count=1,
                time_to_complete_seconds=92,
            ),
            PuzzleCompletionEvent(
                puzzle_id=puzzle_ids[6],
                user_id=3,
                source="archive",
                completed_at=datetime.fromisoformat(_ts(6, 9, 6)),
                wrong_guess_count=0,
                time_to_complete_seconds=58,
            ),
            PuzzleCompletionEvent(
                puzzle_id=puzzle_ids[2],
                guest_session_id="dev-guest-simple-addition",
                source="daily",
                completed_at=datetime.fromisoformat(_ts(2, 16, 20)),
                wrong_guess_count=2,
                time_to_complete_seconds=145,
            ),
            PuzzleCompletionEvent(
                puzzle_id=today_puzzle_id,
                user_id=3,
                source="daily",
                completed_at=datetime.now(timezone.utc).replace(
                    hour=9, minute=16, second=0, microsecond=0
                ),
                wrong_guess_count=1,
                time_to_complete_seconds=74,
            ),
            PuzzleCompletionEvent(
                puzzle_id=today_puzzle_id,
                guest_session_id="dev-guest-today",
                source="daily",
                completed_at=datetime.now(timezone.utc).replace(
                    hour=12, minute=5, second=0, microsecond=0
                ),
                wrong_guess_count=0,
                time_to_complete_seconds=63,
            ),
        ]
        db.add_all(completion_events)

        db.commit()

        _past_count = sum(1 for p in SEED_PUZZLES if p.get("puzzle_date", "") <= today)
        total = db.query(Puzzle).count()
        user_count = db.query(User).count()
        league_count = db.query(League).count()
        print(
            f"Seeded: {total} puzzles, today={today}, {user_count} users, {league_count} leagues, {len(attempts) + 1} attempts, {len(completion_events)} completion events"
        )
        print("Development database ready!")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
