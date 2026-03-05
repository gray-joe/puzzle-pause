from datetime import date, datetime, timedelta

from app.auth import create_jwt, generate_token
from app.models import Attempt, Puzzle
from app.models import Session as SessionModel
from app.models import User


def _make_user(db, email="user@example.com"):
    user = User(email=email)
    db.add(user)
    db.flush()
    token = generate_token(32)
    session = SessionModel(
        user_id=user.id, token=token, expires_at=datetime(2099, 1, 1)
    )
    db.add(session)
    db.commit()
    return user, create_jwt(token)


def _make_puzzle(db, days_ago=1, answer="hello"):
    puzzle_date = (date.today() - timedelta(days=days_ago)).isoformat()
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="word",
        puzzle_name="Archive Puzzle",
        question="What is the word?",
        answer=answer,
        hint="A hint",
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


class TestArchiveList:
    def test_lists_past_puzzles(self, client, db):
        _make_puzzle(db, days_ago=1)
        _make_puzzle(db, days_ago=2)
        resp = client.get("/api/archive")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_excludes_today(self, client, db):
        today = date.today().isoformat()
        puzzle = Puzzle(
            puzzle_date=today,
            puzzle_type="word",
            puzzle_name="Today",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.commit()
        resp = client.get("/api/archive")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    def test_answer_not_in_response(self, client, db):
        _make_puzzle(db, days_ago=1, answer="secret")
        resp = client.get("/api/archive")
        assert "secret" not in resp.text
        assert "answer" not in resp.json()[0]

    def test_solved_indicator_for_auth_user(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        user, jwt = _make_user(db)
        attempt = Attempt(user_id=user.id, puzzle_id=puzzle.id, solved=1, score=80)
        db.add(attempt)
        db.commit()

        resp = client.get("/api/archive", cookies={"session": jwt})
        assert resp.json()[0]["solved"] is True

    def test_solved_none_for_guest(self, client, db):
        _make_puzzle(db, days_ago=1)
        resp = client.get("/api/archive")
        assert resp.json()[0]["solved"] is None

    def test_unsolved_false_for_auth_user(self, client, db):
        _make_puzzle(db, days_ago=1)
        _, jwt = _make_user(db)
        resp = client.get("/api/archive", cookies={"session": jwt})
        assert resp.json()[0]["solved"] is False


class TestArchiveGet:
    def test_returns_puzzle(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        resp = client.get(f"/api/archive/{puzzle.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == puzzle.id

    def test_404_for_today(self, client, db):
        today = date.today().isoformat()
        puzzle = Puzzle(
            puzzle_date=today,
            puzzle_type="word",
            puzzle_name="T",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.commit()
        resp = client.get(f"/api/archive/{puzzle.id}")
        assert resp.status_code == 404

    def test_404_unknown_id(self, client, db):
        resp = client.get("/api/archive/9999")
        assert resp.status_code == 404


class TestArchiveAttempt:
    def test_correct_answer(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        user, jwt = _make_user(db)

        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 0

    def test_wrong_answer_increments_guesses(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        user, jwt = _make_user(db)

        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "nope"},
            cookies={"session": jwt},
        )
        assert resp.json()["correct"] is False
        assert resp.json()["incorrect_guesses"] == 1

    def test_guest_can_attempt(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

    def test_guest_wrong_answer(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "wrong"},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is False


class TestArchiveHint:
    def test_reveals_hint(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        _, jwt = _make_user(db)

        resp = client.post(f"/api/archive/{puzzle.id}/hint", cookies={"session": jwt})
        assert resp.status_code == 200
        assert resp.json()["hint"] == "A hint"

    def test_guest_can_get_hint(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        resp = client.post(f"/api/archive/{puzzle.id}/hint")
        assert resp.status_code == 200
        assert resp.json()["hint"] == "A hint"

    def test_404_no_hint(self, client, db):
        puzzle_date = (date.today() - timedelta(days=1)).isoformat()
        puzzle = Puzzle(
            puzzle_date=puzzle_date,
            puzzle_type="word",
            puzzle_name="T",
            question="Q",
            answer="A",
            hint=None,
        )
        db.add(puzzle)
        db.commit()
        _, jwt = _make_user(db)
        resp = client.post(f"/api/archive/{puzzle.id}/hint", cookies={"session": jwt})
        assert resp.status_code == 404


class TestArchiveResult:
    def test_result_after_solving(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        _, jwt = _make_user(db)
        cookies = {"session": jwt}

        client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies=cookies,
        )
        resp = client.get(f"/api/archive/{puzzle.id}/result", cookies=cookies)
        assert resp.status_code == 200
        assert resp.json()["attempt"]["solved"] is True

    def test_404_before_solving(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        _, jwt = _make_user(db)
        resp = client.get(f"/api/archive/{puzzle.id}/result", cookies={"session": jwt})
        assert resp.status_code == 404
