from datetime import date, datetime, timedelta, timezone

import pytest

from app.auth import create_jwt, generate_token
from app.models import Puzzle, PuzzleCompletionEvent
from app.models import Session as SessionModel
from app.models import User


def _make_user(db, email="user@example.com"):
    user = User(email=email)
    db.add(user)
    db.flush()
    token = generate_token(32)
    session = SessionModel(
        user_id=user.id,
        token=token,
        expires_at=datetime(2099, 1, 1),
    )
    db.add(session)
    db.commit()
    jwt = create_jwt(token)
    return user, jwt


def _make_puzzle(db, puzzle_date=None, answer="hello"):
    if puzzle_date is None:
        puzzle_date = date.today().isoformat()
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="word",
        puzzle_name="Test Puzzle",
        question="What is the word?",
        answer=answer,
        hint="A greeting",
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


def _make_clue_reveal_puzzle(db, puzzle_date=None):
    if puzzle_date is None:
        puzzle_date = date.today().isoformat()
    question = '{"prompt":"Who am I?","clues":["Born in 1564","Wrote Hamlet","Wrote Romeo and Juliet"]}'
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="clue-reveal",
        puzzle_name="Test Clue Reveal",
        question=question,
        answer="Shakespeare",
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


def _make_connections_puzzle(db, puzzle_date=None, hint=None):
    if puzzle_date is None:
        puzzle_date = date.today().isoformat()
    question = '{"prompt":"Group these:","items":["Cobra","Mamba","Java","Ruby"],"categories":["Snakes","Languages"]}'
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="connections",
        puzzle_name="Test Connections",
        question=question,
        answer="0,1|2,3",
        hint=hint,
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


class TestConnections:
    def test_categories_stripped_from_question(self, client, db):
        _make_connections_puzzle(db)
        resp = client.get("/api/puzzle/today")
        assert resp.status_code == 200
        import json
        question = json.loads(resp.json()["question"])
        assert "categories" not in question
        assert "items" in question

    def test_has_hint_true_without_text_hint(self, client, db):
        _make_connections_puzzle(db, hint=None)
        resp = client.get("/api/puzzle/today")
        assert resp.json()["has_hint"] is True

    def test_first_hint_returns_first_category(self, client, db):
        _make_connections_puzzle(db)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1})
        assert resp.status_code == 200
        assert resp.json()["hint"] == "Snakes"
        assert resp.json()["total_hints"] == 2

    def test_second_hint_returns_second_category(self, client, db):
        _make_connections_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        assert resp.status_code == 200
        assert resp.json()["hint"] == "Languages"

    def test_hint_exhausted_returns_404(self, client, db):
        _make_connections_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        assert resp.status_code == 404

    def test_each_hint_increments_count(self, client, db):
        _make_connections_puzzle(db, hint=None)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)

        # Solve and check score deducted 2 × 10 = 20
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "0,1|2,3"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] <= 80  # base 100 − 20 hints

    def test_solve_returns_full_question_with_categories(self, client, db):
        _make_connections_puzzle(db)
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "0,1|2,3"}
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True
        import json
        question = json.loads(resp.json()["question"])
        assert "categories" in question
        assert question["categories"] == ["Snakes", "Languages"]

    def test_auth_solve_returns_full_question(self, client, db):
        _make_connections_puzzle(db)
        user, jwt = _make_user(db)
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "0,1|2,3"},
            cookies={"session": jwt},
        )
        assert resp.json()["correct"] is True
        import json
        question = json.loads(resp.json()["question"])
        assert "categories" in question


class TestTodayPuzzle:
    def test_returns_today_puzzle(self, client, db):
        _make_puzzle(db)
        resp = client.get("/api/puzzle/today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["puzzle_date"] == date.today().isoformat()
        assert "answer" not in data

    def test_no_puzzle_returns_404(self, client, db):
        resp = client.get("/api/puzzle/today")
        assert resp.status_code == 404


class TestAttempt:
    def test_correct_answer(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)

        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct"] is True
        assert data["score"] is not None
        assert data["score"] >= 10

    def test_wrong_answer(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)

        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "wrong"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct"] is False
        assert data["incorrect_guesses"] == 1

    def test_guest_can_attempt(self, client, db):
        _make_puzzle(db, answer="hello")
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "hello"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct"] is True
        assert data["score"] is not None

        events = db.query(PuzzleCompletionEvent).all()
        assert len(events) == 1
        assert events[0].source == "daily"
        assert events[0].user_id is None
        assert events[0].guest_session_id is not None

    def test_guest_wrong_answer_creates_no_completion_event(self, client, db):
        _make_puzzle(db, answer="hello")
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "wrong"}
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is False
        assert db.query(PuzzleCompletionEvent).count() == 0

    def test_guest_score_uses_opened_at(self, client, db):
        _make_puzzle(db, answer="hello")
        opened_at = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello", "opened_at": opened_at},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct"] is True
        assert data["score"] <= 75  # 2 hours → base 75

        event = db.query(PuzzleCompletionEvent).first()
        assert event is not None
        assert event.time_to_complete_seconds is not None
        assert event.time_to_complete_seconds >= 7190

    def test_guest_wrong_answer(self, client, db):
        _make_puzzle(db, answer="hello")
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "wrong"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct"] is False

    def test_already_solved_returns_same_score(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

    def test_auth_correct_response_logs_each_time(self, client, db):
        _make_puzzle(db, answer="hello")
        _, jwt = _make_user(db)
        cookies = {"session": jwt}

        first = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        assert first.status_code == 200
        assert first.json()["correct"] is True

        second = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        assert second.status_code == 200
        assert second.json()["correct"] is True

        events = db.query(PuzzleCompletionEvent).all()
        assert len(events) == 2
        assert all(e.source == "daily" for e in events)
        assert all(e.user_id is not None for e in events)


class TestHint:
    def test_reveals_hint(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)

        resp = client.post(
            "/api/puzzle/hint",
            json={"puzzle_id": 1},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        assert resp.json()["hint"] == "A greeting"

    def test_guest_can_get_hint(self, client, db):
        _make_puzzle(db)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1})
        assert resp.status_code == 200
        assert resp.json()["hint"] == "A greeting"

    def test_hint_reduces_score(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        # Use hint first
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)

        # Then solve
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        # Base score 100 minus 10 for hint = 90
        assert resp.json()["score"] <= 90

    def test_multiple_wrong_guesses_reduce_score(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        # Make 3 wrong guesses (-5 each = -15)
        for _ in range(3):
            client.post(
                "/api/puzzle/attempt",
                json={"puzzle_id": 1, "guess": "wrong"},
                cookies=cookies,
            )

        # Now solve
        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        # Base score 100 minus 15 for guesses = 85
        assert resp.json()["score"] <= 85


class TestResult:
    def test_result_after_solving(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        resp = client.get("/api/puzzle/result", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert data["attempt"]["solved"] is True

    def test_result_not_solved(self, client, db):
        _make_puzzle(db)
        user, jwt = _make_user(db)
        resp = client.get("/api/puzzle/result", cookies={"session": jwt})
        assert resp.status_code == 404

    def test_result_includes_opened_at(self, client, db):
        _make_puzzle(db, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.get("/api/puzzle/today", cookies=cookies)
        client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "hello"},
            cookies=cookies,
        )
        resp = client.get("/api/puzzle/result", cookies=cookies)
        assert resp.status_code == 200
        assert resp.json()["attempt"]["opened_at"] is not None


class TestClueReveal:
    def test_additional_clues_stripped_from_question(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.get("/api/puzzle/today")
        assert resp.status_code == 200
        import json

        question = json.loads(resp.json()["question"])
        assert len(question["clues"]) == 1
        assert question["clues"][0] == "Born in 1564"

    def test_prompt_not_stripped(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.get("/api/puzzle/today")
        import json

        question = json.loads(resp.json()["question"])
        assert question["prompt"] == "Who am I?"

    def test_has_hint_true(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.get("/api/puzzle/today")
        assert resp.json()["has_hint"] is True

    def test_first_hint_returns_first_extra_clue(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1})
        assert resp.status_code == 200
        assert resp.json()["hint"] == "Wrote Hamlet"
        assert resp.json()["total_hints"] == 2

    def test_second_hint_returns_second_extra_clue(self, client, db):
        _make_clue_reveal_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        assert resp.status_code == 200
        assert resp.json()["hint"] == "Wrote Romeo and Juliet"

    def test_clue_hint_exhausted_returns_404(self, client, db):
        _make_clue_reveal_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        resp = client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        assert resp.status_code == 404

    def test_revealed_hint_included_in_today_response(self, client, db):
        _make_clue_reveal_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        resp = client.get("/api/puzzle/today", cookies=cookies)
        assert resp.json()["revealed_hint"] == "Wrote Hamlet"

    def test_each_hint_increments_hint_used(self, client, db):
        _make_clue_reveal_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)
        client.post("/api/puzzle/hint", json={"puzzle_id": 1}, cookies=cookies)

        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "Shakespeare"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] <= 80  # base 100 − 2 × 10 hints

    def test_correct_answer_accepted(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "Shakespeare"}
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

    def test_solve_reveals_full_question_with_all_clues(self, client, db):
        _make_clue_reveal_puzzle(db)
        resp = client.post(
            "/api/puzzle/attempt", json={"puzzle_id": 1, "guess": "Shakespeare"}
        )
        assert resp.json()["correct"] is True
        import json

        question = json.loads(resp.json()["question"])
        assert len(question["clues"]) == 3

    def test_wrong_answer_increments_incorrect_guesses(self, client, db):
        _make_clue_reveal_puzzle(db)
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        resp = client.post(
            "/api/puzzle/attempt",
            json={"puzzle_id": 1, "guess": "Marlowe"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is False
        assert resp.json()["incorrect_guesses"] == 1
