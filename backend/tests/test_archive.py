import json
from datetime import date, datetime, timedelta, timezone

from app.auth import create_jwt, generate_token
from app.models import Attempt, Puzzle, PuzzleCompletionEvent
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
        explanation="The clue asks for hello.",
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

    def test_ordered_by_date_desc(self, client, db):
        _make_puzzle(db, days_ago=5)
        _make_puzzle(db, days_ago=1)
        _make_puzzle(db, days_ago=3)
        resp = client.get("/api/archive")
        dates = [p["puzzle_date"] for p in resp.json()]
        assert dates == sorted(dates, reverse=True)


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
        assert resp.json()["score"] == 90

        attempt = db.query(Attempt).filter(Attempt.user_id == user.id).first()
        assert attempt.source == "archive"

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
        assert resp.json()["score"] == 90
        assert resp.json()["explanation"] == "The clue asks for hello."

        event = db.query(PuzzleCompletionEvent).first()
        assert event is not None
        assert event.source == "archive"
        assert event.user_id is None
        assert event.guest_session_id is not None

    def test_guest_score_uses_client_tracked_penalties(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={
                "puzzle_id": puzzle.id,
                "guess": "hello",
                "incorrect_guesses": 1,
                "hints_used": 1,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 75
        assert resp.json()["incorrect_guesses"] == 1

        event = db.query(PuzzleCompletionEvent).first()
        assert event.wrong_guess_count == 1

    def test_guest_wrong_answer(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "wrong"},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is False
        assert db.query(PuzzleCompletionEvent).count() == 0

    def test_auth_correct_response_logs_each_time(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        _, jwt = _make_user(db)
        cookies = {"session": jwt}

        first = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies=cookies,
        )
        assert first.status_code == 200
        assert first.json()["correct"] is True

        second = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies=cookies,
        )
        assert second.status_code == 200
        assert second.json()["correct"] is True

        events = db.query(PuzzleCompletionEvent).all()
        assert len(events) == 2
        assert all(e.source == "archive" for e in events)

    def test_archive_score_has_ten_point_deduction(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        user, jwt = _make_user(db)
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies={"session": jwt},
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 90

    def test_archive_hint_deducts_points(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        # Use hint
        client.post(f"/api/archive/{puzzle.id}/hint", cookies=cookies)

        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 80

    def test_archive_multi_hint_deducts_each_hint(self, client, db):
        puzzle_date = (date.today() - timedelta(days=1)).isoformat()
        puzzle = Puzzle(
            puzzle_date=puzzle_date,
            puzzle_type="connections",
            puzzle_name="Connections",
            question=json.dumps(
                {
                    "words": ["a", "b", "c", "d"],
                    "categories": ["letters", "alphabet"],
                }
            ),
            answer="letters alphabet",
        )
        db.add(puzzle)
        db.commit()
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        first_hint = client.post(f"/api/archive/{puzzle.id}/hint", cookies=cookies)
        second_hint = client.post(f"/api/archive/{puzzle.id}/hint", cookies=cookies)

        assert first_hint.status_code == 200
        assert first_hint.json() == {"hint": "letters", "total_hints": 2}
        assert second_hint.status_code == 200
        assert second_hint.json() == {"hint": "alphabet", "total_hints": 2}

        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "letters alphabet"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 70

    def test_archive_score_bottoms_out_at_ten(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        user, jwt = _make_user(db)
        cookies = {"session": jwt}

        for _ in range(20):
            client.post(
                f"/api/archive/{puzzle.id}/attempt",
                json={"puzzle_id": puzzle.id, "guess": "wrong"},
                cookies=cookies,
            )

        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello"},
            cookies=cookies,
        )
        assert resp.json()["correct"] is True
        assert resp.json()["score"] == 10

    def test_guest_opened_at_sets_time_to_complete(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1, answer="hello")
        opened_at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        resp = client.post(
            f"/api/archive/{puzzle.id}/attempt",
            json={"puzzle_id": puzzle.id, "guess": "hello", "opened_at": opened_at},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

        event = db.query(PuzzleCompletionEvent).first()
        assert event is not None
        assert event.time_to_complete_seconds is not None
        assert event.time_to_complete_seconds >= 290


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
        assert resp.json()["puzzle"]["explanation"] == "The clue asks for hello."

    def test_404_before_solving(self, client, db):
        puzzle = _make_puzzle(db, days_ago=1)
        _, jwt = _make_user(db)
        resp = client.get(f"/api/archive/{puzzle.id}/result", cookies={"session": jwt})
        assert resp.status_code == 404
