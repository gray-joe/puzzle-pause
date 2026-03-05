from datetime import datetime, timedelta

from app.auth import create_jwt, generate_token
from app.models import Attempt, League, LeagueMember, Puzzle
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


def _make_league(db, creator, name="Test League"):
    league = League(name=name, invite_code="ABC123", creator_id=creator.id)
    db.add(league)
    db.flush()
    db.add(LeagueMember(league_id=league.id, user_id=creator.id))
    db.commit()
    db.refresh(league)
    return league


class TestListLeagues:
    def test_returns_user_leagues(self, client, db):
        user, jwt = _make_user(db)
        _make_league(db, user)
        resp = client.get("/api/leagues", cookies={"session": jwt})
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_excludes_other_leagues(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, jwt2 = _make_user(db, "b@example.com")
        _make_league(db, user2, "Other League")
        resp = client.get("/api/leagues", cookies={"session": jwt1})
        assert resp.json() == []

    def test_includes_user_rank_and_score(self, client, db):
        user, jwt = _make_user(db)
        _make_league(db, user)
        resp = client.get("/api/leagues", cookies={"session": jwt})
        data = resp.json()[0]
        assert "user_rank" in data
        assert "user_score" in data
        assert data["user_rank"] == 1
        assert data["user_score"] == 0

    def test_requires_auth(self, client):
        resp = client.get("/api/leagues")
        assert resp.status_code == 401


class TestCreateLeague:
    def test_creates_league(self, client, db):
        _, jwt = _make_user(db)
        resp = client.post(
            "/api/leagues", json={"name": "My League"}, cookies={"session": jwt}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My League"
        assert len(data["invite_code"]) == 6
        assert data["member_count"] == 1

    def test_creator_is_member(self, client, db):
        user, jwt = _make_user(db)
        resp = client.post(
            "/api/leagues", json={"name": "My League"}, cookies={"session": jwt}
        )
        league_id = resp.json()["id"]
        member = (
            db.query(LeagueMember)
            .filter(
                LeagueMember.league_id == league_id,
                LeagueMember.user_id == user.id,
            )
            .first()
        )
        assert member is not None

    def test_requires_auth(self, client):
        resp = client.post("/api/leagues", json={"name": "X"})
        assert resp.status_code == 401


class TestGetLeague:
    def test_member_can_view(self, client, db):
        user, jwt = _make_user(db)
        league = _make_league(db, user)
        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt})
        assert resp.status_code == 200
        assert resp.json()["id"] == league.id
        assert "leaderboard_today" in resp.json()

    def test_non_member_forbidden(self, client, db):
        user1, _ = _make_user(db, "a@example.com")
        user2, jwt2 = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt2})
        assert resp.status_code == 403

    def test_404_unknown(self, client, db):
        _, jwt = _make_user(db)
        resp = client.get("/api/leagues/9999", cookies={"session": jwt})
        assert resp.status_code == 404


class TestJoinLeague:
    def test_join_by_code(self, client, db):
        creator, _ = _make_user(db, "creator@example.com")
        new_member, jwt = _make_user(db, "new_member@example.com")
        league = _make_league(db, creator)

        resp = client.post(
            "/api/leagues/join",
            json={"invite_code": "ABC123"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        assert resp.json()["member_count"] == 2

    def test_join_case_insensitive(self, client, db):
        creator, _ = _make_user(db, "creator@example.com")
        new_member, jwt = _make_user(db, "new_member@example.com")
        _make_league(db, creator)

        resp = client.post(
            "/api/leagues/join",
            json={"invite_code": "abc123"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200

    def test_join_idempotent(self, client, db):
        user, jwt = _make_user(db)
        _make_league(db, user)
        resp = client.post(
            "/api/leagues/join",
            json={"invite_code": "ABC123"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 200
        assert resp.json()["member_count"] == 1

    def test_join_invalid_code(self, client, db):
        _, jwt = _make_user(db)
        resp = client.post(
            "/api/leagues/join",
            json={"invite_code": "XXXXXX"},
            cookies={"session": jwt},
        )
        assert resp.status_code == 404


class TestDeleteLeague:
    def test_creator_can_delete(self, client, db):
        user, jwt = _make_user(db)
        league = _make_league(db, user)
        resp = client.delete(f"/api/leagues/{league.id}", cookies={"session": jwt})
        assert resp.status_code == 204
        assert db.query(League).filter(League.id == league.id).first() is None

    def test_non_creator_cannot_delete(self, client, db):
        creator, _ = _make_user(db, "a@example.com")
        other, jwt = _make_user(db, "b@example.com")
        league = _make_league(db, creator)
        db.add(LeagueMember(league_id=league.id, user_id=other.id))
        db.commit()

        resp = client.delete(f"/api/leagues/{league.id}", cookies={"session": jwt})
        assert resp.status_code == 403


class TestLeaveLeague:
    def test_member_can_leave(self, client, db):
        creator, _ = _make_user(db, "a@example.com")
        member, jwt = _make_user(db, "b@example.com")
        league = _make_league(db, creator)
        db.add(LeagueMember(league_id=league.id, user_id=member.id))
        db.commit()

        resp = client.post(f"/api/leagues/{league.id}/leave", cookies={"session": jwt})
        assert resp.status_code == 200
        remaining = (
            db.query(LeagueMember).filter(LeagueMember.league_id == league.id).count()
        )
        assert remaining == 1

    def test_last_member_leaving_deletes_league(self, client, db):
        user, jwt = _make_user(db)
        league = _make_league(db, user)
        resp = client.post(f"/api/leagues/{league.id}/leave", cookies={"session": jwt})
        assert resp.status_code == 200
        assert db.query(League).filter(League.id == league.id).first() is None

    def test_creator_leave_transfers_ownership(self, client, db):
        creator, jwt = _make_user(db, "creator@example.com")
        other, _ = _make_user(db, "other@example.com")
        league = _make_league(db, creator)
        db.add(LeagueMember(league_id=league.id, user_id=other.id))
        db.commit()

        client.post(f"/api/leagues/{league.id}/leave", cookies={"session": jwt})
        db.refresh(league)
        assert league.creator_id == other.id


def _make_puzzle(db, days_ago=1):
    from datetime import date

    puzzle_date = (date.today() - timedelta(days=days_ago)).isoformat()
    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        puzzle_type="word",
        puzzle_name="P",
        question="Q",
        answer="A",
    )
    db.add(puzzle)
    db.commit()
    db.refresh(puzzle)
    return puzzle


def _make_attempt(
    db, user_id, puzzle_id, solved=1, score=80, incorrect_guesses=0, hint_used=0, hour=12
):
    attempt = Attempt(
        user_id=user_id,
        puzzle_id=puzzle_id,
        solved=solved,
        score=score,
        incorrect_guesses=incorrect_guesses,
        hint_used=hint_used,
        completed_at=datetime(2024, 6, 1, hour, 0, 0),
    )
    db.add(attempt)
    db.commit()
    return attempt


class TestLeagueTags:
    def test_guesser_tag(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, _ = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        db.add(LeagueMember(league_id=league.id, user_id=user2.id))
        db.commit()

        p1 = _make_puzzle(db, days_ago=1)
        p2 = _make_puzzle(db, days_ago=2)
        # user1 has 1 incorrect guess total, user2 has 5
        _make_attempt(db, user1.id, p1.id, incorrect_guesses=1)
        _make_attempt(db, user2.id, p1.id, incorrect_guesses=3)
        _make_attempt(db, user2.id, p2.id, incorrect_guesses=2)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt1})
        tags = resp.json()["tags"]
        assert tags["guesser"]["user_id"] == user2.id

    def test_one_shotter_tag(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, _ = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        db.add(LeagueMember(league_id=league.id, user_id=user2.id))
        db.commit()

        puzzles = [_make_puzzle(db, days_ago=i) for i in range(1, 5)]
        # user1: 3/4 perfect (75%), user2: 4/4 perfect (100%)
        for i, p in enumerate(puzzles):
            _make_attempt(db, user1.id, p.id, incorrect_guesses=(1 if i == 0 else 0))
            _make_attempt(db, user2.id, p.id, incorrect_guesses=0)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt1})
        tags = resp.json()["tags"]
        assert tags["one_shotter"]["user_id"] == user2.id

    def test_one_shotter_requires_three_solves(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, _ = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        db.add(LeagueMember(league_id=league.id, user_id=user2.id))
        db.commit()

        puzzles = [_make_puzzle(db, days_ago=i) for i in range(1, 5)]
        # user1 has 3 solves (qualifies), user2 has 2 (doesn't)
        for p in puzzles[:3]:
            _make_attempt(db, user1.id, p.id, incorrect_guesses=0)
        for p in puzzles[:2]:
            _make_attempt(db, user2.id, p.id, incorrect_guesses=0)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt1})
        tags = resp.json()["tags"]
        assert tags["one_shotter"]["user_id"] == user1.id

    def test_early_riser_tag(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, _ = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        db.add(LeagueMember(league_id=league.id, user_id=user2.id))
        db.commit()

        puzzles = [_make_puzzle(db, days_ago=i) for i in range(1, 5)]
        # user1 solves at 12:00, user2 at 7:00 (earlier)
        for p in puzzles:
            _make_attempt(db, user1.id, p.id, hour=12)
            _make_attempt(db, user2.id, p.id, hour=7)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt1})
        tags = resp.json()["tags"]
        assert tags["early_riser"]["user_id"] == user2.id

    def test_hint_lover_tag(self, client, db):
        user1, jwt1 = _make_user(db, "a@example.com")
        user2, _ = _make_user(db, "b@example.com")
        league = _make_league(db, user1)
        db.add(LeagueMember(league_id=league.id, user_id=user2.id))
        db.commit()

        p1 = _make_puzzle(db, days_ago=1)
        p2 = _make_puzzle(db, days_ago=2)
        _make_attempt(db, user1.id, p1.id, hint_used=1)
        _make_attempt(db, user2.id, p1.id, hint_used=1)
        _make_attempt(db, user2.id, p2.id, hint_used=1)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt1})
        tags = resp.json()["tags"]
        assert tags["hint_lover"]["user_id"] == user2.id

    def test_tags_empty_no_data(self, client, db):
        user, jwt = _make_user(db)
        league = _make_league(db, user)

        resp = client.get(f"/api/leagues/{league.id}", cookies={"session": jwt})
        tags = resp.json()["tags"]
        assert tags["guesser"] is None
        assert tags["one_shotter"] is None
        assert tags["early_riser"] is None
        assert tags["hint_lover"] is None
