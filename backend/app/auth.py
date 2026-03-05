import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Session as SessionModel
from .models import User

OTAC_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no I, L, O, 0, 1
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30
AUTH_MAX_CODE_ATTEMPTS = 5


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET environment variable not set")
    return secret


def generate_token(n_bytes: int = 32) -> str:
    return secrets.token_hex(n_bytes)


def generate_otac() -> str:
    return "".join(secrets.choice(OTAC_CHARSET) for _ in range(6))


def generate_invite_code() -> str:
    return "".join(
        secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(6)
    )


def create_jwt(session_token: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    payload = {"sub": session_token, "exp": expire}
    return pyjwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> str | None:
    try:
        payload = pyjwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except pyjwt.PyJWTError:
        return None


def _extract_token(session: str | None, authorization: str | None) -> str | None:
    if session:
        return session
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def _get_user_from_token(token: str, db: Session) -> User | None:
    session_token = decode_jwt(token)
    if not session_token:
        return None

    session = (
        db.query(SessionModel)
        .filter(
            SessionModel.token == session_token,
            SessionModel.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        return None

    return db.query(User).filter(User.id == session.user_id).first()


def get_current_session(
    session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> SessionModel | None:
    token = _extract_token(session, authorization)
    if not token:
        return None
    session_token = decode_jwt(token)
    if not session_token:
        return None
    return (
        db.query(SessionModel)
        .filter(
            SessionModel.token == session_token,
            SessionModel.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


def get_current_user(
    session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    token = _extract_token(session, authorization)
    if not token:
        return None
    return _get_user_from_token(token, db)


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    admin_emails = os.environ.get("ADMIN_EMAILS", "")
    allowed = [e.strip().lower() for e in admin_emails.split(",") if e.strip()]
    if user.email.lower() not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return user
