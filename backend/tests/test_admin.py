from datetime import datetime

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

    def test_includes_answer(self, client, db):
        _make_puzzle(db)
        resp = client.get("/api/admin/puzzles", cookies=_admin_cookies(db))
        assert resp.json()[0]["answer"] == "A"

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
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 201
        assert resp.json()["puzzle_date"] == "2025-06-01"
        assert resp.json()["answer"] == "answer"

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
        valid_types = [
            "word",
            "math",
            "ladder",
            "choice",
            "wordsearch",
            "order",
            "match",
            "connections",
            "image-tap",
            "image-order",
        ]
        cookies = _admin_cookies(db)
        for i, ptype in enumerate(valid_types):
            resp = client.post(
                "/api/admin/puzzles",
                json={
                    "puzzle_date": f"2030-01-{i+1:02d}",
                    "puzzle_type": ptype,
                    "puzzle_name": ptype,
                    "question": "Q",
                    "answer": "A",
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
            },
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 200
        assert resp.json()["puzzle_name"] == "Updated"
        assert resp.json()["answer"] == "new_answer"

    def test_partial_update(self, client, db):
        puzzle = _make_puzzle(db)
        resp = client.put(
            f"/api/admin/puzzles/{puzzle.id}",
            json={"puzzle_name": "Only Name Changed"},
            cookies=_admin_cookies(db),
        )
        assert resp.status_code == 200
        assert resp.json()["answer"] == "A"  # unchanged

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

    def test_404_unknown(self, client, db):
        resp = client.delete("/api/admin/puzzles/9999", cookies=_admin_cookies(db))
        assert resp.status_code == 404
