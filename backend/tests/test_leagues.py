from datetime import datetime

from app.auth import create_jwt, generate_token
from app.models import League, LeagueMember
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
