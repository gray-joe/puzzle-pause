from unittest.mock import AsyncMock, patch

import pytest

from datetime import datetime

from app.auth import OTAC_CHARSET, generate_otac
from app.models import AuthToken, User


class TestOtac:
    def test_charset_only(self):
        for _ in range(100):
            code = generate_otac()
            assert len(code) == 6
            assert all(c in OTAC_CHARSET for c in code)
            for excluded in "ILO01":
                assert excluded not in code


class TestLogin:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_login_sends_code(self, mock_send, client):
        resp = client.post("/api/auth/login", json={"email": "test@example.com"})
        assert resp.status_code == 200
        mock_send.assert_called_once()
        email, code = mock_send.call_args[0]
        assert email == "test@example.com"
        assert len(code) == 6

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_login_creates_auth_token(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        assert token is not None
        assert token.short_code is not None
        assert token.used == 0

    def test_login_invalid_email(self, client):
        resp = client.post("/api/auth/login", json={"email": "not-an-email"})
        assert resp.status_code == 422

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_login_blocked_email_does_not_create_token(
        self, mock_send, client, db, monkeypatch
    ):
        monkeypatch.setenv("AUTH_BLOCKED_EMAILS", " crawlerrobo@gmail.com ")

        resp = client.post("/api/auth/login", json={"email": "CrawlerRobo@Gmail.com"})

        assert resp.status_code == 200
        assert resp.json() == {"message": "Code sent"}
        mock_send.assert_not_called()
        token = (
            db.query(AuthToken).filter(AuthToken.email == "crawlerrobo@gmail.com").first()
        )
        assert token is None


class TestVerify:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_valid_code(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        code = token.short_code

        resp = client.post(
            "/api/auth/verify", json={"email": "test@example.com", "code": code}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_wrong_code(self, mock_send, client):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        resp = client.post(
            "/api/auth/verify", json={"email": "test@example.com", "code": "ZZZZZZ"}
        )
        assert resp.status_code == 400

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_creates_user(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "new@example.com"})
        token = db.query(AuthToken).filter(AuthToken.email == "new@example.com").first()

        client.post(
            "/api/auth/verify",
            json={"email": "new@example.com", "code": token.short_code},
        )

        user = db.query(User).filter(User.email == "new@example.com").first()
        assert user is not None

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_sets_cookie(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )

        resp = client.post(
            "/api/auth/verify",
            json={"email": "test@example.com", "code": token.short_code},
        )
        assert "session" in resp.cookies

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_blocked_email_rejects_existing_token(
        self, mock_send, client, db, monkeypatch
    ):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        monkeypatch.setenv("AUTH_BLOCKED_EMAILS", "test@example.com")

        resp = client.post(
            "/api/auth/verify",
            json={"email": "test@example.com", "code": token.short_code},
        )

        assert resp.status_code == 400
        assert resp.json() == {"detail": "Invalid or expired code"}
        assert db.query(User).filter(User.email == "test@example.com").first() is None


class TestMe:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_me_authenticated(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        auth_token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        verify_resp = client.post(
            "/api/auth/verify",
            json={"email": "test@example.com", "code": auth_token.short_code},
        )
        jwt = verify_resp.json()["token"]

        resp = client.get("/api/auth/me", cookies={"session": jwt})
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    def test_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


class TestLogout:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_logout_clears_session(self, mock_send, client, db):
        from app.models import Session as SessionModel

        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        verify_resp = client.post(
            "/api/auth/verify",
            json={"email": "test@example.com", "code": token.short_code},
        )
        jwt = verify_resp.json()["token"]

        resp = client.post("/api/auth/logout", cookies={"session": jwt})
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out"

        # Session should be deleted from DB
        assert db.query(SessionModel).count() == 0

    def test_logout_unauthenticated_still_succeeds(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out"


class TestVerifyExpiry:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_expired_token(self, mock_send, client, db):
        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        code = token.short_code

        # Expire the token
        token.expires_at = datetime(2020, 1, 1)
        db.commit()

        resp = client.post(
            "/api/auth/verify", json={"email": "test@example.com", "code": code}
        )
        assert resp.status_code == 400

    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_verify_max_attempts_locks_out(self, mock_send, client, db):
        from app.auth import AUTH_MAX_CODE_ATTEMPTS

        client.post("/api/auth/login", json={"email": "test@example.com"})
        token = (
            db.query(AuthToken).filter(AuthToken.email == "test@example.com").first()
        )
        correct_code = token.short_code

        # Use up all attempts with wrong codes
        for _ in range(AUTH_MAX_CODE_ATTEMPTS):
            client.post(
                "/api/auth/verify",
                json={"email": "test@example.com", "code": "ZZZZZZ"},
            )

        # Now even the correct code should fail
        resp = client.post(
            "/api/auth/verify",
            json={"email": "test@example.com", "code": correct_code},
        )
        assert resp.status_code == 400


class TestLoginLockout:
    @patch("app.routers.auth.send_otac_email", new_callable=AsyncMock)
    def test_login_blocked_after_lockout(self, mock_send, client, db):
        from app.auth import AUTH_MAX_CODE_ATTEMPTS

        # First login — get a code
        client.post("/api/auth/login", json={"email": "test@example.com"})

        # Exhaust all attempts on the token
        for _ in range(AUTH_MAX_CODE_ATTEMPTS):
            client.post(
                "/api/auth/verify",
                json={"email": "test@example.com", "code": "ZZZZZZ"},
            )

        # Now try to request a new login — should be blocked
        resp = client.post("/api/auth/login", json={"email": "test@example.com"})
        assert resp.status_code == 429


class TestSessionExpiry:
    def test_expired_session_rejected(self, client, db):
        from app.auth import create_jwt, generate_token
        from app.models import Session as SessionModel

        user = User(email="test@example.com")
        db.add(user)
        db.flush()
        token = generate_token(32)
        session = SessionModel(
            user_id=user.id, token=token, expires_at=datetime(2020, 1, 1)
        )
        db.add(session)
        db.commit()
        jwt = create_jwt(token)

        resp = client.get("/api/auth/me", cookies={"session": jwt})
        assert resp.status_code == 401
