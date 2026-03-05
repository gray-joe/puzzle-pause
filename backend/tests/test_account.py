from datetime import date, datetime, timedelta, timezone

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


def _make_solved_attempt(db, user, days_ago=1, score=80):
    puzzle_date = (date.today() - timedelta(days=days_ago)).isoformat()
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="word",
        puzzle_name="P",
        question="Q",
        answer="A",
    )
    db.add(puzzle)
    db.flush()
    attempt = Attempt(
        user_id=user.id,
        puzzle_id=puzzle.id,
        solved=1,
        score=score,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()


class TestGetAccount:
    def test_returns_account(self, client, db):
        _, jwt = _make_user(db)
        resp = client.get("/api/account", cookies={"session": jwt})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "user@example.com"
        assert "stats" in data

    def test_stats_puzzles_solved(self, client, db):
        user, jwt = _make_user(db)
        _make_solved_attempt(db, user, days_ago=1, score=90)
        _make_solved_attempt(db, user, days_ago=2, score=70)

        resp = client.get("/api/account", cookies={"session": jwt})
        stats = resp.json()["stats"]
        assert stats["puzzles_solved"] == 2
        assert stats["average_score"] == 80.0
        assert stats["alltime_total"] == 160

    def test_stats_zero_when_no_attempts(self, client, db):
        _, jwt = _make_user(db)
        resp = client.get("/api/account", cookies={"session": jwt})
        stats = resp.json()["stats"]
        assert stats["puzzles_solved"] == 0
        assert stats["alltime_total"] == 0

    def test_streak_consecutive_days(self, client, db):
        user, jwt = _make_user(db)
        _make_solved_attempt(db, user, days_ago=1)
        _make_solved_attempt(db, user, days_ago=2)
        _make_solved_attempt(db, user, days_ago=3)

        resp = client.get("/api/account", cookies={"session": jwt})
        assert resp.json()["stats"]["streak"] == 3

    def test_streak_broken(self, client, db):
        user, jwt = _make_user(db)
        _make_solved_attempt(db, user, days_ago=1)
        _make_solved_attempt(db, user, days_ago=3)

        resp = client.get("/api/account", cookies={"session": jwt})
        assert resp.json()["stats"]["streak"] == 1

    def test_requires_auth(self, client):
        resp = client.get("/api/account")
        assert resp.status_code == 401


class TestUpdateAccount:
    def test_updates_display_name(self, client, db):
        name, jwt = _make_user(db)
        resp = client.patch(
            "/api/account", json={"display_name": "Alice"}, cookies={"session": jwt}
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Alice"

    def test_persists_display_name(self, client, db):
        user, jwt = _make_user(db)
        client.patch(
            "/api/account", json={"display_name": "Alice"}, cookies={"session": jwt}
        )
        db.refresh(user)
        assert user.display_name == "Alice"

    def test_requires_auth(self, client):
        resp = client.patch("/api/account", json={"display_name": "X"})
        assert resp.status_code == 401
