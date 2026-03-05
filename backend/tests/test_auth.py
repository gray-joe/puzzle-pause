from unittest.mock import AsyncMock, patch

import pytest

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
