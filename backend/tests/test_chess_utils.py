import json

import pytest

from app.chess_utils import board_from_question, check_chess_answer, side_to_move_label, validate_chess_puzzle


SCHOLAR_QUESTION = json.dumps(
    {"fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"}
)
BLACK_MATE_QUESTION = json.dumps({"fen": "8/8/8/8/8/8/5k2/4q2K b - - 0 1"})


class TestChessUtils:
    def test_side_to_move_label(self):
        assert side_to_move_label(board_from_question(SCHOLAR_QUESTION)) == "White"
        assert side_to_move_label(board_from_question(BLACK_MATE_QUESTION)) == "Black"

    def test_check_answer_accepts_san_and_uci(self):
        assert check_chess_answer(SCHOLAR_QUESTION, "Qxf7#", "Qxf7#") is True
        assert check_chess_answer(SCHOLAR_QUESTION, "Qxf7#", "Qxf7") is True
        assert check_chess_answer(SCHOLAR_QUESTION, "Qxf7#", "h5f7") is True

    def test_check_answer_rejects_wrong_move(self):
        assert check_chess_answer(SCHOLAR_QUESTION, "Qxf7#", "Nf3") is False
        assert check_chess_answer(SCHOLAR_QUESTION, "Qxf7#", "not-a-move") is False

    def test_check_answer_accepts_alternative_answers(self):
        assert check_chess_answer(BLACK_MATE_QUESTION, "Qg1#|Kg3#", "Kg3#") is True

    def test_validate_requires_mating_move(self):
        with pytest.raises(ValueError, match="mate-in-1"):
            validate_chess_puzzle(SCHOLAR_QUESTION, "Nf3")
