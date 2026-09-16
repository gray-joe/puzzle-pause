import pytest

from app.word_ladder_v2 import (
    check_word_ladder_v2_answer,
    validate_word_ladder_v2_puzzle,
    word_ladder_v2_length_penalty,
    word_ladder_v2_letter_feedback,
)

pytestmark = pytest.mark.unit


def test_accepts_authored_reference_path():
    validate_word_ladder_v2_puzzle("cold, warm", "cord, card, ward")


def test_accepts_any_dictionary_valid_path():
    assert check_word_ladder_v2_answer("cold, warm", "cord, card, ward")


@pytest.mark.parametrize(
    "guess",
    [
        "xxxx, card, ward",
        "cord, cards, ward",
        "cord, card, word",
        "",
    ],
)
def test_rejects_invalid_ladders(guess):
    assert not check_word_ladder_v2_answer("cold, warm", guess)


def test_feedback_compares_letters_to_reference_path():
    assert word_ladder_v2_letter_feedback(
        "cord, card, ward", "core, cart, word, worm"
    ) == [
        [True, True, True, False],
        [True, True, True, False],
        [True, False, True, True],
        [False, False, False, False],
    ]


def test_accepts_redundant_trailing_final_word():
    assert check_word_ladder_v2_answer("cold, warm", "cord, card, ward, warm")
    assert word_ladder_v2_length_penalty("cold, warm", "cord, card, ward, warm") == 0


def test_no_penalty_for_shortest_valid_path():
    assert check_word_ladder_v2_answer("cold, warm", "cord, card, ward")
    assert word_ladder_v2_length_penalty("cold, warm", "cord, card, ward") == 0


def test_penalty_for_longer_valid_path():
    guess = "cord, curd, card, ward"
    assert check_word_ladder_v2_answer("cold, warm", guess)
    assert word_ladder_v2_length_penalty("cold, warm", guess) == 10
