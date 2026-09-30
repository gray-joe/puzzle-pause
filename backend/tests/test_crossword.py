"""Tests for crossword validation, numbering, and answer checking."""

import json

import pytest

from app.puzzle import check_answer
from app.puzzle_validation import crossword_numbers, validate_puzzle

pytestmark = pytest.mark.unit

# CAT
# A#O
# BOW
LAYOUT = ["...", ".#.", "..."]
ANSWER = "CATA#OBOW"
CLUES = {
    "across": {"1": "Feline", "3": "Take a ___"},
    "down": {"1": "Taxi", "2": "Pull a car"},
}


def _question(**overrides) -> str:
    data = {"prompt": "Mini", "layout": LAYOUT, "clues": CLUES, **overrides}
    return json.dumps(data)


def test_numbering():
    assert crossword_numbers(LAYOUT) == (["1", "3"], ["1", "2"])


def test_valid():
    validate_puzzle("crossword", _question(), ANSWER)


def test_answer_length_mismatch():
    with pytest.raises(ValueError, match="9 characters"):
        validate_puzzle("crossword", _question(), "CATAOBOW")


def test_black_squares_must_match():
    with pytest.raises(ValueError, match="black squares"):
        validate_puzzle("crossword", _question(), "CAT#AOBOW")


def test_lowercase_answer_rejected():
    with pytest.raises(ValueError, match="uppercase"):
        validate_puzzle("crossword", _question(), "cata#obow")


def test_missing_clue_rejected():
    clues = {"across": {"1": "Feline"}, "down": CLUES["down"]}
    with pytest.raises(ValueError, match="across clues must be numbered 1, 3"):
        validate_puzzle("crossword", _question(clues=clues), ANSWER)


def test_non_numeric_clue_key_rejected():
    clues = {"across": {"1": "Feline", "x": "?"}, "down": CLUES["down"]}
    with pytest.raises(ValueError, match="across clues"):
        validate_puzzle("crossword", _question(clues=clues), ANSWER)


def test_ragged_layout_rejected():
    with pytest.raises(ValueError, match="same length"):
        validate_puzzle("crossword", _question(layout=["...", "..", "..."]), ANSWER)


def test_too_large_rejected():
    layout = ["." * 16] * 16
    with pytest.raises(ValueError, match="3–15 rows"):
        validate_puzzle("crossword", _question(layout=layout), "A" * 256)


def test_guess_is_case_insensitive():
    assert check_answer("cata#obow", ANSWER)
    assert not check_answer("cata#obox", ANSWER)
