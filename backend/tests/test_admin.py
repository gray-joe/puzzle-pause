from datetime import datetime

import pytest

from app.auth import create_jwt, generate_token
from app.models import Attempt, Puzzle, PuzzleCompletionEvent, User
from app.models import Session as SessionModel

pytestmark = pytest.mark.api


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


def _admin_cookies(db):
    _, jwt = _make_user(db, email="admin@example.com")
    return {"session": jwt}


def _make_puzzle(db, puzzle_date="2024-01-01"):
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="word",
        puzzle_name="Test",
        question="Q",
        answer="A",
        hint="H",
        explanation="Because Q points to A.",
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


class TestAdminListPuzzles:
    def test_lists_all_puzzles(self, client, db):
        _make_puzzle(db, "2024-01-01")
        _make_puzzle(db, "2024-01-02")
        resp = client.get("/api/admin/puzzles", cookies=_admin_cookies(db))
        assert resp.status_code == 200
        assert len(resp.json()) == 2
        assert [p["puzzle_date"] for p in resp.json()] == ["2024-01-02", "2024-01-01"]

    def test_supports_limit_and_offset(self, client, db):
        _make_puzzle(db, "2024-01-01")
        middle = _make_puzzle(db, "2024-01-02")
        newest = _make_puzzle(db, "2024-01-03")

        resp = client.get(
            "/api/admin/puzzles?limit=1&offset=1", cookies=_admin_cookies(db)
        )

        assert resp.status_code == 200
        assert [p["id"] for p in resp.json()] == [middle.id]
        assert resp.json()[0]["id"] != newest.id

    def test_includes_answer(self, client, db):
        _make_puzzle(db)
        resp = client.get("/api/admin/puzzles", cookies=_admin_cookies(db))
        assert resp.json()[0]["answer"] == "A"

    def test_includes_explanation(self, client, db):
        _make_puzzle(db)
        resp = client.get("/api/admin/puzzles", cookies=_admin_cookies(db))
        assert resp.json()[0]["explanation"] == "Because Q points to A."

    def test_non_admin_forbidden(self, client, db):
        _, jwt = _make_user(db, "plain@example.com")
        resp = client.get("/api/admin/puzzles", cookies={"session": jwt})
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, client):
        resp = client.get("/api/admin/puzzles")
        assert resp.status_code == 401


class TestAdminCreatePuzzle:
    def test_creates_puzzle(self, client, db):
        resp = client.post(
            "/api/admin/puzzles",
            json={
                "puzzle_date": "2025-06-01",
                "puzzle_type": "word",
                "puzzle_name": "Test",
                "question": "What?",
                "answer": "answer",
                "hint": "a clue",
                "explanation": "This is why the answer works.",
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 201
        assert resp.json()["puzzle_date"] == "2025-06-01"
        assert resp.json()["answer"] == "answer"
        assert resp.json()["explanation"] == "This is why the answer works."

    def test_rejects_duplicate_date(self, client, db):
        _make_puzzle(db, "2024-01-01")
        resp = client.post(
            "/api/admin/puzzles",
            json={
                "puzzle_date": "2024-01-01",
                "puzzle_type": "word",
                "puzzle_name": "Dup",
                "question": "Q",
                "answer": "A",
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 409

    def test_rejects_invalid_type(self, client, db):
        resp = client.post(
            "/api/admin/puzzles",
            json={
                "puzzle_date": "2025-07-01",
                "puzzle_type": "bogus",
                "puzzle_name": "X",
                "question": "Q",
                "answer": "A",
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 400

    def test_all_valid_types_accepted(self, client, db):
        # Each entry: (puzzle_type, question, answer)
        valid_puzzles = [
            ("word", "What is a four-letter word for happy?", "glad"),
            ("math", "What is 2 + 2?", "4"),
            ("ladder", "C_T, C_P, C_R", "a, u, a"),
            ("choice", "What is 1+1?|One|Two|Three", "B"),
            ("wordsearch", "A B C\nD E F\nG H I\nFind: ABC", "ABC"),
            ("order", '{"prompt":"Sort:","items":["B","A"]}', "1,0"),
            ("match", '{"prompt":"Match:","left":["A","B"],"right":["X","Y"]}', "0,1"),
            (
                "connections",
                '{"prompt":"Group:","items":["a","b","c","d"],"categories":["X","Y"]}',
                "0,1|2,3",
            ),
            ("image-tap", '{"prompt":"Click:","image_url":"/img.jpg"}', "0.5,0.5"),
            ("image-order", '{"prompt":"Sort:","images":["/a.jpg","/b.jpg"]}', "0,1"),
        ]
        cookies = _admin_cookies(db)
        for i, (ptype, question, answer) in enumerate(valid_puzzles):
            resp = client.post(
                "/api/admin/puzzles",
                json={
                    "puzzle_date": f"2030-01-{i + 1:02d}",
                    "puzzle_type": ptype,
                    "puzzle_name": ptype,
                    "question": question,
                    "answer": answer,
                },
                cookies=cookies,
            )
            assert resp.status_code == 201, f"{ptype} rejected: {resp.json()}"


class TestAdminGetPuzzle:
    def test_returns_puzzle_with_answer(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.get(f"/api/admin/puzzles/{puzzle.id}", cookies=_admin_cookies(db))
        assert resp.status_code == 200
        assert resp.json()["answer"] == "A"

    def test_404_unknown(self, client, db):
        resp = client.get("/api/admin/puzzles/9999", cookies=_admin_cookies(db))
        assert resp.status_code == 404


class TestAdminUpdatePuzzle:
    def test_updates_fields(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.put(
            f"/api/admin/puzzles/{puzzle.id}",
            json={
                "puzzle_name": "Updated",
                "answer": "new_answer",
                "explanation": "Updated logic.",
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 200
        assert resp.json()["puzzle_name"] == "Updated"
        assert resp.json()["answer"] == "new_answer"
        assert resp.json()["explanation"] == "Updated logic."

    def test_partial_update(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.put(
            f"/api/admin/puzzles/{puzzle.id}",
            json={"puzzle_name": "Only Name Changed"},
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 200
        assert resp.json()["answer"] == "A"  # unchanged

    def test_can_clear_explanation(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.put(
            f"/api/admin/puzzles/{puzzle.id}",
            json={"explanation": None},
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 200
        assert resp.json()["explanation"] is None

    def test_rejects_invalid_type(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.put(
            f"/api/admin/puzzles/{puzzle.id}",
            json={"puzzle_type": "bogus"},
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 400

    def test_404_unknown(self, client, db):
        resp = client.put(
            "/api/admin/puzzles/9999",
            json={"puzzle_name": "X"},
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 404


class TestAdminDeletePuzzle:
    def test_deletes_puzzle(self, client, db):
        puzzle = _make_puzzle(db)
        puzzle_id = puzzle.id
        resp = client.delete(
            f"/api/admin/puzzles/{puzzle_id}", cookies=_admin_cookies(db)
        )
        assert resp.status_code == 204
        assert db.query(Puzzle).filter(Puzzle.id == puzzle_id).first() is None

    def test_deletes_puzzle_with_completion_events(self, client, db):
        puzzle = _make_puzzle(db)
        puzzle_id = puzzle.id
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle_id,
                guest_session_id="guest-1",
                source="daily",
                wrong_guess_count=0,
                time_to_complete_seconds=12,
            )
        )
        db.commit()

        resp = client.delete(
            f"/api/admin/puzzles/{puzzle_id}", cookies=_admin_cookies(db)
        )

        assert resp.status_code == 204
        assert db.query(Puzzle).filter(Puzzle.id == puzzle_id).first() is None
        assert (
            db.query(PuzzleCompletionEvent)
            .filter(PuzzleCompletionEvent.puzzle_id == puzzle_id)
            .count()
            == 0
        )

    def test_404_unknown(self, client, db):
        resp = client.delete("/api/admin/puzzles/9999", cookies=_admin_cookies(db))
        assert resp.status_code == 404


class TestAdminStats:
    def test_returns_counts(self, client, db):
        cookies = _admin_cookies(db)
        puzzle = _make_puzzle(db, "2024-01-01")
        # Admin user already created by _admin_cookies, so we have 1 user
        # Create an attempt
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        attempt = Attempt(user_id=admin.id, puzzle_id=puzzle.id, solved=1, score=80)
        db.add(attempt)
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=admin.id,
                source="daily",
                wrong_guess_count=0,
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                guest_session_id="guest-1",
                source="archive",
            )
        )
        db.commit()

        resp = client.get("/api/admin/stats", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert data["puzzles"] == 1
        assert data["players"] == 1
        assert data["attempts"] == 1
        assert data["completion_events"] == 2
        assert data["guest_completion_events"] == 1
        assert data["auth_completion_events"] == 1

    def test_admin_only(self, client, db):
        _, jwt = _make_user(db, "plain@example.com")
        resp = client.get("/api/admin/stats", cookies={"session": jwt})
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, client):
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 401


class TestAdminUsers:
    def test_supports_limit_and_offset(self, client, db):
        cookies = _admin_cookies(db)
        _make_user(db, "old@example.com")
        middle, _ = _make_user(db, "middle@example.com")
        newest, _ = _make_user(db, "newest@example.com")

        resp = client.get("/api/admin/users?limit=1&offset=1", cookies=cookies)

        assert resp.status_code == 200
        assert [u["id"] for u in resp.json()] == [middle.id]
        assert resp.json()[0]["id"] != newest.id


class TestAdminAttempts:
    def test_supports_limit_and_offset(self, client, db):
        cookies = _admin_cookies(db)
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        oldest_puzzle = _make_puzzle(db, "2024-01-01")
        middle_puzzle = _make_puzzle(db, "2024-01-02")
        newest_puzzle = _make_puzzle(db, "2024-01-03")
        oldest = Attempt(user_id=admin.id, puzzle_id=oldest_puzzle.id, solved=0)
        middle = Attempt(
            user_id=admin.id, puzzle_id=middle_puzzle.id, solved=1, score=80
        )
        newest = Attempt(
            user_id=admin.id, puzzle_id=newest_puzzle.id, solved=1, score=90
        )
        db.add_all([oldest, middle, newest])
        db.commit()

        resp = client.get("/api/admin/attempts?limit=1&offset=1", cookies=cookies)

        assert resp.status_code == 200
        assert [a["id"] for a in resp.json()] == [middle.id]
        assert resp.json()[0]["id"] != newest.id


class TestAdminCompletionEvents:
    def test_returns_stream(self, client, db):
        cookies = _admin_cookies(db)
        puzzle = _make_puzzle(db, "2024-01-01")
        admin = db.query(User).filter(User.email == "admin@example.com").first()

        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                user_id=admin.id,
                source="daily",
                wrong_guess_count=2,
                time_to_complete_seconds=123,
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                guest_session_id="guest-stream-1",
                source="archive",
            )
        )
        db.commit()

        resp = client.get("/api/admin/completion-events", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

        first = data[0]
        assert first["source"] == "archive"
        assert first["user_id"] is None
        assert first["guest_session_id"] == "guest-stream-1"
        assert first["puzzle_date"] == "2024-01-01"

        second = data[1]
        assert second["source"] == "daily"
        assert second["user_id"] == admin.id
        assert second["wrong_guess_count"] == 2
        assert second["time_to_complete_seconds"] == 123

    def test_supports_limit_and_offset(self, client, db):
        cookies = _admin_cookies(db)
        puzzle = _make_puzzle(db, "2024-01-01")

        oldest = PuzzleCompletionEvent(
            puzzle_id=puzzle.id,
            guest_session_id="g-oldest",
            source="daily",
        )
        middle = PuzzleCompletionEvent(
            puzzle_id=puzzle.id,
            guest_session_id="g-middle",
            source="daily",
        )
        newest = PuzzleCompletionEvent(
            puzzle_id=puzzle.id,
            guest_session_id="g-newest",
            source="daily",
        )
        db.add_all([oldest, middle, newest])
        db.commit()

        resp = client.get(
            "/api/admin/completion-events?limit=1&offset=1",
            cookies=cookies,
        )

        assert resp.status_code == 200
        assert [event["id"] for event in resp.json()] == [middle.id]
        assert resp.json()[0]["id"] != newest.id

    def test_admin_only(self, client, db):
        _, jwt = _make_user(db, "plain@example.com")
        resp = client.get("/api/admin/completion-events", cookies={"session": jwt})
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, client):
        resp = client.get("/api/admin/completion-events")
        assert resp.status_code == 401

    def test_filters_source_actor_and_puzzle_type(self, client, db):
        cookies = _admin_cookies(db)
        p1 = _make_puzzle(db, "2024-01-01")
        p2 = Puzzle(
            puzzle_date="2024-01-02",
            puzzle_type="math",
            puzzle_name="Math",
            question="Q",
            answer="A",
        )
        db.add(p2)
        db.commit()
        db.refresh(p2)

        admin = db.query(User).filter(User.email == "admin@example.com").first()

        db.add(
            PuzzleCompletionEvent(
                puzzle_id=p1.id,
                user_id=admin.id,
                source="daily",
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=p1.id,
                guest_session_id="guest-stream-2",
                source="archive",
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=p2.id,
                guest_session_id="guest-stream-3",
                source="daily",
            )
        )
        db.commit()

        resp = client.get(
            "/api/admin/completion-events?source=daily&actor=guest&puzzle_type=math",
            cookies=cookies,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["source"] == "daily"
        assert data[0]["user_id"] is None
        assert data[0]["puzzle_type"] == "math"

    def test_rejects_invalid_filters(self, client, db):
        cookies = _admin_cookies(db)
        resp = client.get("/api/admin/completion-events?source=weekly", cookies=cookies)
        assert resp.status_code == 400
        resp = client.get("/api/admin/completion-events?actor=robot", cookies=cookies)
        assert resp.status_code == 400

    def test_filters_completed_date_range(self, client, db):
        cookies = _admin_cookies(db)
        puzzle = _make_puzzle(db, "2024-01-01")

        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                source="daily",
                guest_session_id="g-old",
                completed_at=datetime(2024, 1, 1, 9, 0, 0, tzinfo=None),
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                source="daily",
                guest_session_id="g-mid",
                completed_at=datetime(2024, 1, 2, 9, 0, 0, tzinfo=None),
            )
        )
        db.add(
            PuzzleCompletionEvent(
                puzzle_id=puzzle.id,
                source="daily",
                guest_session_id="g-new",
                completed_at=datetime(2024, 1, 3, 9, 0, 0, tzinfo=None),
            )
        )
        db.commit()

        resp = client.get(
            "/api/admin/completion-events?completed_from=2024-01-02&completed_to=2024-01-02",
            cookies=cookies,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["guest_session_id"] == "g-mid"

    def test_rejects_invalid_date_filters(self, client, db):
        cookies = _admin_cookies(db)
        resp = client.get(
            "/api/admin/completion-events?completed_from=2024-99-99",
            cookies=cookies,
        )
        assert resp.status_code == 400
        resp = client.get(
            "/api/admin/completion-events?completed_to=not-a-date",
            cookies=cookies,
        )
        assert resp.status_code == 400
