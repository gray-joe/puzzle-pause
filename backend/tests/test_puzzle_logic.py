from datetime import datetime, timezone

import pytest

from app.puzzle import calculate_score, check_answer, normalize_answer


class TestNormalizeAnswer:
    def test_strips_whitespace(self):
        assert normalize_answer("  hello  ") == "hello"

    def test_lowercases(self):
        assert normalize_answer("HELLO") == "hello"

    def test_collapses_spaces(self):
        assert normalize_answer("hello   world") == "hello world"

    def test_converts_comma_to_space(self):
        assert normalize_answer("a,b,c") == "a b c"

    def test_converts_dash_to_space(self):
        assert normalize_answer("a-b") == "a b"

    def test_converts_arrow_to_space(self):
        assert normalize_answer("a>b") == "a b"


class TestCheckAnswer:
    def test_exact_match(self):
        assert check_answer("hello", "hello") is True

    def test_case_insensitive(self):
        assert check_answer("HELLO", "hello") is True

    def test_wrong_answer(self):
        assert check_answer("wrong", "hello") is False

    def test_pipe_alternatives(self):
        assert check_answer("cat", "dog|cat|fish") is True
        assert check_answer("dog", "dog|cat|fish") is True
        assert check_answer("bird", "dog|cat|fish") is False

    def test_unordered_match(self):
        assert check_answer("world hello", "~hello world") is True

    def test_unordered_mismatch(self):
        assert check_answer("hello world extra", "~hello world") is False

    def test_normalizes_before_compare(self):
        assert check_answer("  Hello  ", "hello") is True

    def test_comma_as_separator(self):
        assert check_answer("a,b,c", "a b c") is True


class TestCalculateScore:
    def _release(self, puzzle_date: str) -> datetime:
        y, m, d = map(int, puzzle_date.split("-"))
        return datetime(y, m, d, 9, 0, 0, tzinfo=timezone.utc)

    def test_within_10_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score("2024-01-01", solved, 0, False) == 100

    def test_10_to_30_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=20)
        assert calculate_score("2024-01-01", solved, 0, False) == 90

    def test_incorrect_guess_deducts_5(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score("2024-01-01", solved, 2, False) == 90

    def test_hint_deducts_10(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score("2024-01-01", solved, 0, True) == 90

    def test_minimum_score_10(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(hours=20)
        assert calculate_score("2024-01-01", solved, 10, True) == 10

    def test_30_to_60_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=45)
        assert calculate_score("2024-01-01", solved, 0, False) == 80

    def test_1_to_2_hours(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(hours=1, minutes=30)
        assert calculate_score("2024-01-01", solved, 0, False) == 75

    def test_2_to_3_hours(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(hours=2, minutes=30)
        assert calculate_score("2024-01-01", solved, 0, False) == 70
