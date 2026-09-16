"""Validation and answer checking for variable-length word ladders."""

from __future__ import annotations

from collections import deque
from functools import lru_cache
from string import ascii_lowercase

from wordfreq import zipf_frequency

LENGTH_PENALTY = 10


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


@lru_cache(maxsize=512)
def _shortest_ladder_word_count(start: str, end: str) -> int | None:
    """BFS over dictionary words to find the fewest words needed (including both endpoints)."""
    if len(start) != len(end):
        return None
    if start == end:
        return 1

    visited = {start}
    queue: deque[tuple[str, int]] = deque([(start, 1)])
    while queue:
        word, dist = queue.popleft()
        for index in range(len(word)):
            for letter in ascii_lowercase:
                if letter == word[index]:
                    continue
                candidate = word[:index] + letter + word[index + 1 :]
                if candidate in visited:
                    continue
                if candidate != end and not is_dictionary_word(candidate):
                    continue
                if candidate == end:
                    return dist + 1
                visited.add(candidate)
                queue.append((candidate, dist + 1))
    return None


def word_ladder_v2_length_penalty(question: str, guess: str) -> int:
    """Flat penalty applied when a valid guessed ladder is longer than the shortest possible one."""
    try:
        start, end = parse_endpoints(question)
    except ValueError:
        return 0

    shortest = _shortest_ladder_word_count(start, end)
    if shortest is None:
        return 0

    guessed_words = _drop_trailing_final_word(parse_words(guess), end)
    guess_word_count = len(guessed_words) + 2
    return LENGTH_PENALTY if guess_word_count > shortest else 0


def word_ladder_v2_letter_feedback(answer: str, guess: str) -> list[list[bool]]:
    """Compare guessed intermediate words with the authored reference path."""
    expected_words = parse_words(answer)
    guessed_words = parse_words(guess)
    feedback = []
    for row, guessed in enumerate(guessed_words):
        expected = expected_words[row] if row < len(expected_words) else ""
        feedback.append(
            [
                index < len(expected) and letter == expected[index]
                for index, letter in enumerate(guessed)
            ]
        )
    return feedback
