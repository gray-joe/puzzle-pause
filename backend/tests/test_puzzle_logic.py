from datetime import datetime, timezone

import pytest

from app.puzzle import (
    calculate_archive_score,
    calculate_score,
    check_answer,
    normalize_answer,
)

pytestmark = pytest.mark.unit


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

    def test_connections_exact_order(self):
        assert (
            check_answer("0,1,2,5|3,4,6,7|8,9,10,11", "0,1,2,5|3,4,6,7|8,9,10,11")
            is True
        )

    def test_connections_groups_reordered(self):
        assert (
            check_answer("8,9,10,11|0,1,2,5|3,4,6,7", "0,1,2,5|3,4,6,7|8,9,10,11")
            is True
        )

    def test_connections_items_within_group_reordered(self):
        assert (
            check_answer("5,2,1,0|7,6,4,3|11,10,9,8", "0,1,2,5|3,4,6,7|8,9,10,11")
            is True
        )

    def test_connections_wrong_grouping(self):
        assert (
            check_answer("0,1,2,3|4,5,6,7|8,9,10,11", "0,1,2,5|3,4,6,7|8,9,10,11")
            is False
        )


class TestCalculateScore:
    def _release(self, puzzle_date: str) -> datetime:
        y, m, d = map(int, puzzle_date.split("-"))
        return datetime(y, m, d, 9, 0, 0, tzinfo=timezone.utc)

    def test_within_10_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score(release, solved, 0, 0) == 100

    def test_10_to_15_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=12)
        assert calculate_score(release, solved, 0, 0) == 90

    def test_15_to_30_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=20)
        assert calculate_score(release, solved, 0, 0) == 75

    def test_incorrect_guess_deducts_5(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score(release, solved, 2, 0) == 90

    def test_hint_deducts_10(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score(release, solved, 0, 1) == 90

    def test_three_hints_deducts_30(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=5)
        assert calculate_score(release, solved, 0, 3) == 70

    def test_minimum_score_10(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(hours=20)
        assert calculate_score(release, solved, 10, 1) == 10

    def test_30_to_60_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(minutes=45)
        assert calculate_score(release, solved, 0, 0) == 50

    def test_over_60_min(self):
        release = self._release("2024-01-01")
        from datetime import timedelta

        solved = release + timedelta(hours=2)
        assert calculate_score(release, solved, 0, 0) == 30

    def test_none_opened_at_gives_max_base(self):

        solved = self._release("2024-01-01")
        assert calculate_score(None, solved, 0, 0) == 100

    def test_archive_deducts_10(self):
        from datetime import timedelta

        release = self._release("2024-01-01")
        solved = release + timedelta(minutes=5)
        assert calculate_archive_score(release, solved, 0, 0) == 90

    def test_archive_minimum_score_10(self):
        from datetime import timedelta

        release = self._release("2024-01-01")
        solved = release + timedelta(hours=20)
        assert calculate_archive_score(release, solved, 10, 1) == 10
