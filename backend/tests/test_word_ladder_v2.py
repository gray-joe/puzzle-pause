import pytest
from wordfreq import zipf_frequency

from app.word_ladder_v2 import (
    ROUTE_ZIPF_CUTOFFS,
    check_word_ladder_v2_answer,
    shortest_route_answer,
    validate_word_ladder_v2_puzzle,
    word_ladder_v2_length_penalty,
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


def test_accepts_redundant_trailing_final_word():
    assert check_word_ladder_v2_answer("cold, warm", "cord, card, ward, warm")
    assert word_ladder_v2_length_penalty("cold, warm", "cord, card, ward, warm") == 0


def test_no_penalty_for_shortest_valid_path():
    assert check_word_ladder_v2_answer("cold, warm", "cord, card, ward")
    assert word_ladder_v2_length_penalty("cold, warm", "cord, card, ward") == 0


def test_penalty_for_longer_valid_path():
    guess = "cord, curd, card, ward, wart"
    assert check_word_ladder_v2_answer("cold, warm", guess)
    assert word_ladder_v2_length_penalty("cold, warm", guess) == 10


def test_shortest_route_answer_is_a_shortest_valid_ladder():
    answer = shortest_route_answer("cold, warm")
    assert check_word_ladder_v2_answer("cold, warm", answer)
    assert word_ladder_v2_length_penalty("cold, warm", answer) == 0


def test_shortest_route_prefers_common_words():
    words = shortest_route_answer("cold, warm").split(", ")
    assert all(zipf_frequency(word, "en") >= ROUTE_ZIPF_CUTOFFS[0] for word in words)


def test_shortest_route_is_not_lengthened_by_a_high_cutoff():
    assert shortest_route_answer("pear, bite") == "peas, pets, bets, bits"


def test_shortest_route_falls_back_to_rare_words():
    # No route exists through words above the first cut-off.
    answer = shortest_route_answer("army, navy")
    assert check_word_ladder_v2_answer("army, navy", answer)


@pytest.mark.parametrize("question", ["cold, warmer", "cold", "qxzv, warm"])
def test_shortest_route_answer_rejects_impossible_ladders(question):
    with pytest.raises(ValueError):
        validate_word_ladder_v2_puzzle(question, shortest_route_answer(question))
