"""Validation and answer checking for variable-length word ladders."""

from __future__ import annotations

from collections import deque
from functools import lru_cache
from string import ascii_lowercase

from wordfreq import zipf_frequency

LENGTH_PENALTY = 10
# Shortest routes are searched through words at least this common first, falling back
# to rarer words only when no route exists. Higher cut-offs mean fewer obscure words but
# needlessly long routes (4.0 turned pear -> bite into 8 steps instead of 4).
ROUTE_ZIPF_CUTOFFS = (3.5, 3.0, 0)


def parse_words(value: str) -> list[str]:
    return [word.strip().lower() for word in value.split(",") if word.strip()]


def parse_endpoints(question: str) -> tuple[str, str]:
    words = parse_words(question)
    if len(words) != 2:
        raise ValueError(
            "word-ladder-v2 question must contain exactly two comma-separated words"
        )
    return words[0], words[1]


def is_dictionary_word(word: str) -> bool:
    return word.isascii() and word.isalpha() and zipf_frequency(word, "en") > 0


def is_single_letter_change(first: str, second: str) -> bool:
    return len(first) == len(second) and sum(a != b for a, b in zip(first, second)) == 1


def validate_ladder(words: list[str]) -> bool:
    if len(words) < 3:
        return False
    word_length = len(words[0])
    return (
        word_length > 0
        and all(len(word) == word_length for word in words)
        and all(is_dictionary_word(word) for word in words)
        and all(
            is_single_letter_change(first, second)
            for first, second in zip(words, words[1:])
        )
    )


def validate_word_ladder_v2_puzzle(question: str, answer: str) -> None:
    start, end = parse_endpoints(question)
    authored_words = parse_words(answer)
    if not authored_words:
        raise ValueError(
            "word-ladder-v2 answer must contain at least one intermediate word"
        )
    if not validate_ladder([start, *authored_words, end]):
        raise ValueError(
            "word-ladder-v2 answer must form a dictionary-valid ladder with "
            "equal-length words and one changed letter per step"
        )


def _drop_trailing_final_word(words: list[str], end: str) -> list[str]:
    """Users may redundantly type the final word as their last row; treat it the same as omitting it."""
    if words and words[-1] == end:
        return words[:-1]
    return words


def check_word_ladder_v2_answer(question: str, guess: str) -> bool:
    try:
        start, end = parse_endpoints(question)
    except ValueError:
        return False
    guessed_words = _drop_trailing_final_word(parse_words(guess), end)
    return validate_ladder([start, *guessed_words, end])


def shortest_ladder(start: str, end: str) -> tuple[str, ...] | None:
    """Shortest ladder through the most common words that can make one."""
    for min_zipf in ROUTE_ZIPF_CUTOFFS:
        if ladder := _search(start, end, min_zipf):
            return ladder
    return None


@lru_cache(maxsize=512)
def _search(start: str, end: str, min_zipf: float) -> tuple[str, ...] | None:
    """BFS over dictionary words for the shortest ladder (including both endpoints)."""
    if len(start) != len(end):
        return None
    if start == end:
        return (start,)

    parents: dict[str, str | None] = {start: None}
    queue: deque[str] = deque([start])
    while queue:
        word = queue.popleft()
        for index in range(len(word)):
            for letter in ascii_lowercase:
                if letter == word[index]:
                    continue
                candidate = word[:index] + letter + word[index + 1 :]
                if candidate in parents:
                    continue
                if candidate != end and not (
                    is_dictionary_word(candidate)
                    and zipf_frequency(candidate, "en") >= min_zipf
                ):
                    continue
                parents[candidate] = word
                if candidate == end:
                    path = [candidate]
                    while (parent := parents[path[-1]]) is not None:
                        path.append(parent)
                    return tuple(reversed(path))
                queue.append(candidate)
    return None


def shortest_route_answer(question: str) -> str:
    """The intermediate words of the shortest ladder, stored as the puzzle answer."""
    start, end = parse_endpoints(question)
    ladder = shortest_ladder(start, end)
    if ladder is None:
        raise ValueError(f"no word ladder exists from '{start}' to '{end}'")
    return ", ".join(ladder[1:-1])


def word_ladder_v2_length_penalty(question: str, guess: str) -> int:
    """Flat penalty applied when a valid guessed ladder is longer than the shortest possible one."""
    try:
        start, end = parse_endpoints(question)
    except ValueError:
        return 0

    shortest = shortest_ladder(start, end)
    if shortest is None:
        return 0

    guessed_words = _drop_trailing_final_word(parse_words(guess), end)
    guess_word_count = len(guessed_words) + 2
    return LENGTH_PENALTY if guess_word_count > len(shortest) else 0
