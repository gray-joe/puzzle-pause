import re
from datetime import datetime, timezone


def normalize_answer(s: str) -> str:
    """Strip, lowercase, collapse whitespace; treat ,-> as spaces."""
    s = s.strip().lower()
    s = re.sub(r"[,\-\>]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def check_answer(guess: str, answer: str) -> bool:
    """
    ~prefix: unordered word match
    | separator: alternative answers
    """
    guess_norm = normalize_answer(guess)

    if answer.startswith("~"):
        return _check_unordered(guess_norm, answer[1:])

    for alt in answer.split("|"):
        if normalize_answer(alt) == guess_norm:
            return True

    return False


def _check_unordered(guess_norm: str, answer_words: str) -> bool:
    g_words = sorted(guess_norm.split())
    a_words = sorted(normalize_answer(answer_words).split())
    return g_words == a_words


def calculate_score(
    puzzle_date: str, solved_at: datetime, incorrect_guesses: int, hint_used: bool
) -> int:
    year, month, day = map(int, puzzle_date.split("-"))
    release = datetime(year, month, day, 9, 0, 0, tzinfo=timezone.utc)

    if solved_at.tzinfo is None:
        solved_at = solved_at.replace(tzinfo=timezone.utc)

    diff = (solved_at - release).total_seconds()
    if diff < 0:
        diff = 0

    minutes = int(diff / 60)

    if minutes <= 10:
        base = 100
    elif minutes <= 30:
        base = 90
    elif minutes <= 60:
        base = 80
    elif minutes <= 120:
        base = 75
    elif minutes <= 180:
        base = 70
    else:
        extra_hours = (minutes - 180) // 60
        base = 70 - (5 * extra_hours)

    score = base - (incorrect_guesses * 5) - (10 if hint_used else 0)
    return max(score, 10)


def get_puzzle_date() -> str:
    now = datetime.now(timezone.utc)
    if now.hour < 9:
        from datetime import timedelta

        now = now - timedelta(days=1)
    return now.strftime("%Y-%m-%d")
