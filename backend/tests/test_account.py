from datetime import date, datetime, timedelta, timezone

from app.auth import create_jwt, generate_token
from app.models import (
    Attempt,
    AuthToken,
    League,
    LeagueMember,
    Puzzle,
    PuzzleCompletionEvent,
)
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


def _make_solved_attempt(db, user, days_ago=1, score=80, source="daily"):
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
        source=source,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()
    return puzzle


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

    def test_top_percentile_has_one_percent_minimum(self, client, db):
        top_user, jwt = _make_user(db, "top@example.com")
        other_user, _ = _make_user(db, "other@example.com")
        puzzle = Puzzle(
            puzzle_date=(date.today() - timedelta(days=1)).isoformat(),
            puzzle_type="word",
            puzzle_name="P",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.flush()
        db.add(Attempt(user_id=top_user.id, puzzle_id=puzzle.id, solved=1, score=100))
        db.add(Attempt(user_id=other_user.id, puzzle_id=puzzle.id, solved=1, score=50))
        db.commit()

        resp = client.get("/api/account", cookies={"session": jwt})

        assert resp.json()["stats"]["percentile"] == 1

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

    def test_streak_excludes_archive_puzzles(self, client, db):
        user, jwt = _make_user(db)
        _make_solved_attempt(db, user, days_ago=1, score=80)
        _make_solved_attempt(db, user, days_ago=2, score=90, source="archive")

        resp = client.get("/api/account", cookies={"session": jwt})
        assert resp.json()["stats"]["streak"] == 1

    def test_requires_auth(self, client):
        resp = client.get("/api/account")
        assert resp.status_code == 401


class TestGetCompletedDates:
    def test_returns_solved_attempt_dates_for_user(self, client, db):
        user, jwt = _make_user(db)
        puzzle = _make_solved_attempt(db, user, days_ago=1)

        resp = client.get(
            "/api/account/completed-dates",
            params={"start": puzzle.puzzle_date, "end": puzzle.puzzle_date},
            cookies={"session": jwt},
        )

        assert resp.status_code == 200
        assert resp.json() == {"completed_dates": [puzzle.puzzle_date]}

    def test_excludes_unsolved_attempts(self, client, db):
        user, jwt = _make_user(db)
        puzzle = Puzzle(
            puzzle_date=(date.today() - timedelta(days=1)).isoformat(),
            puzzle_type="word",
            puzzle_name="P",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.flush()
        db.add(Attempt(user_id=user.id, puzzle_id=puzzle.id, solved=0))
        db.commit()

        resp = client.get(
            "/api/account/completed-dates",
            params={"start": puzzle.puzzle_date, "end": puzzle.puzzle_date},
            cookies={"session": jwt},
        )

        assert resp.status_code == 200
        assert resp.json() == {"completed_dates": []}

    def test_returns_guest_completion_dates(self, client, db):
        puzzle = Puzzle(
            puzzle_date=(date.today() - timedelta(days=1)).isoformat(),
            puzzle_type="word",
            puzzle_name="P",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.flush()
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                guest_session_id="guest-123",
                completed_at=datetime.now(timezone.utc),
                source="daily",
            )
        )
        db.commit()

        resp = client.get(
            "/api/account/completed-dates",
            params={"start": puzzle.puzzle_date, "end": puzzle.puzzle_date},
            cookies={"guest_session": "guest-123"},
        )

        assert resp.status_code == 200
        assert resp.json() == {"completed_dates": [puzzle.puzzle_date]}

    def test_excludes_guest_give_up_dates(self, client, db):
        puzzle = Puzzle(
            puzzle_date=(date.today() - timedelta(days=1)).isoformat(),
            puzzle_type="word",
            puzzle_name="P",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.flush()
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                guest_session_id="guest-123",
                completed_at=datetime.now(timezone.utc),
                source="daily",
                gave_up=1,
            )
        )
        db.commit()

        resp = client.get(
            "/api/account/completed-dates",
            params={"start": puzzle.puzzle_date, "end": puzzle.puzzle_date},
            cookies={"guest_session": "guest-123"},
        )

        assert resp.status_code == 200
        assert resp.json() == {"completed_dates": []}

    def test_returns_empty_without_completion_identity(self, client):
        today = date.today().isoformat()
        resp = client.get(
            "/api/account/completed-dates",
            params={"start": today, "end": today},
        )

        assert resp.status_code == 200
        assert resp.json() == {"completed_dates": []}


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


class TestDeleteAccount:
    def test_deletes_user(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        resp = client.delete("/api/account", cookies={"session": jwt})
        assert resp.status_code == 200
        assert db.query(User).filter(User.id == user_id).count() == 0

    def test_clears_session_cookie(self, client, db):
        _, jwt = _make_user(db)
        resp = client.delete("/api/account", cookies={"session": jwt})
        assert "session" in resp.headers.get("set-cookie", "")

    def test_deletes_sessions(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        client.delete("/api/account", cookies={"session": jwt})
        assert db.query(SessionModel).filter(SessionModel.user_id == user_id).count() == 0

    def test_deletes_auth_tokens_by_user_id_and_email(self, client, db):
        user, jwt = _make_user(db)
        email = user.email
        db.add(
            AuthToken(
                user_id=user.id,
                email=email,
                token="linked-token",
                expires_at=datetime(2099, 1, 1),
            )
        )
        db.add(
            AuthToken(
                user_id=None,
                email=email,
                token="email-only-token",
                expires_at=datetime(2099, 1, 1),
            )
        )
        db.add(
            AuthToken(
                user_id=None,
                email="other@example.com",
                token="other-token",
                expires_at=datetime(2099, 1, 1),
            )
        )
        db.commit()

        client.delete("/api/account", cookies={"session": jwt})

        assert db.query(AuthToken).filter(AuthToken.email == email).count() == 0
        assert (
            db.query(AuthToken).filter(AuthToken.email == "other@example.com").count()
            == 1
        )

    def test_deletes_attempts(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        _make_solved_attempt(db, user)
        client.delete("/api/account", cookies={"session": jwt})
        assert db.query(Attempt).filter(Attempt.user_id == user_id).count() == 0

    def test_deletes_completion_events(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        puzzle = Puzzle(
            puzzle_date=(date.today() - timedelta(days=1)).isoformat(),
            puzzle_type="word",
            puzzle_name="P",
            question="Q",
            answer="A",
        )
        db.add(puzzle)
        db.flush()
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=user_id,
                completed_at=datetime.now(timezone.utc),
                source="daily",
            )
        )
        db.commit()
        client.delete("/api/account", cookies={"session": jwt})
        assert (
            db.query(PuzzleCompletionEvent)
            .filter(PuzzleCompletionEvent.user_id == user_id)
            .count()
            == 0
        )

    def test_deletes_league_memberships(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        other, _ = _make_user(db, "other@example.com")
        league = League(name="Test", invite_code="ABC123", creator_id=other.id)
        db.add(league)
        db.flush()
        db.add(LeagueMember(league_id=league.id, user_id=user_id))
        db.commit()
        client.delete("/api/account", cookies={"session": jwt})
        assert (
            db.query(LeagueMember)
            .filter(LeagueMember.user_id == user_id)
            .count()
            == 0
        )

    def test_deletes_leagues_user_created(self, client, db):
        user, jwt = _make_user(db)
        user_id = user.id
        league = League(name="Test", invite_code="ABC123", creator_id=user_id)
        db.add(league)
        db.flush()
        league_id = league.id
        db.commit()
        client.delete("/api/account", cookies={"session": jwt})
        assert db.query(League).filter(League.id == league_id).count() == 0

    def test_transfers_ownership_of_created_leagues_with_other_members(self, client, db):
        creator, jwt = _make_user(db)
        creator_id = creator.id
        other, _ = _make_user(db, "other@example.com")
        other_id = other.id
        league = League(name="Test", invite_code="ABC123", creator_id=creator_id)
        db.add(league)
        db.flush()
        db.add(LeagueMember(league_id=league.id, user_id=creator_id))
        db.add(LeagueMember(league_id=league.id, user_id=other_id))
        db.commit()

        client.delete("/api/account", cookies={"session": jwt})

        db.refresh(league)
        assert league.creator_id == other_id
        assert (
            db.query(LeagueMember)
            .filter(LeagueMember.user_id == creator_id)
            .count()
            == 0
        )
        assert (
            db.query(LeagueMember)
            .filter(LeagueMember.user_id == other_id)
            .count()
            == 1
        )

    def test_requires_auth(self, client):
        resp = client.delete("/api/account")
        assert resp.status_code == 401
