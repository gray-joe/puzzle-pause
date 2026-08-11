import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

_LONDON = ZoneInfo("Europe/London")


def normalize_answer(s: str) -> str:
    """Strip, lowercase, collapse whitespace; treat ,-> as spaces."""
    s = s.strip().lower()
    s = re.sub(r"[,\-\>]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_groups(s: str) -> frozenset:
    """Normalize a pipe-separated, comma-separated index answer (e.g. connections/order).
    Groups are order-independent; indices within each group are order-independent."""
    return frozenset(
        frozenset(item.strip() for item in group.split(",")) for group in s.split("|")
    )


def _looks_like_groups(s: str) -> bool:
    return "|" in s and re.fullmatch(r"[\d,| ]+", s.strip()) is not None


def check_answer(guess: str, answer: str) -> bool:
    """
    ~prefix: unordered word match
    | separator: alternative answers
    For index-group answers (connections), groups and their contents are order-independent.
    """
    if _looks_like_groups(answer) and _looks_like_groups(guess):
        return _normalize_groups(guess) == _normalize_groups(answer)

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
    opened_at: datetime | None,
    solved_at: datetime,
    incorrect_guesses: int,
    hints_used: int,
) -> int:

    if opened_at is None:
        opened_at = solved_at

    if opened_at.tzinfo is None:
        opened_at = opened_at.replace(tzinfo=timezone.utc)

    if solved_at.tzinfo is None:
        solved_at = solved_at.replace(tzinfo=timezone.utc)

    diff = (solved_at - opened_at).total_seconds()
    if diff < 0:
        diff = 0

    minutes = int(diff / 60)

    if minutes <= 10:
        base = 100
    elif minutes <= 15:
        base = 90
    elif minutes <= 30:
        base = 75
    elif minutes <= 60:
        base = 50
    else:
        base = 30

    score = base - (incorrect_guesses * 5) - (hints_used * 10)
    return max(score, 10)


def calculate_archive_score(
    opened_at: datetime | None,
    solved_at: datetime,
    incorrect_guesses: int,
    hints_used: int,
) -> int:
    return max(
        calculate_score(opened_at, solved_at, incorrect_guesses, hints_used) - 10, 10
    )


def get_puzzle_date() -> str:
    now = datetime.now(_LONDON)
    return now.strftime("%Y-%m-%d")
