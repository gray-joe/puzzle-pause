from datetime import date, datetime

import pytest

from app.auth import create_jwt, generate_token
from app.models import Puzzle
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
