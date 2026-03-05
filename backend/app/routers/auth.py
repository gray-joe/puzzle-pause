import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..auth import (
    AUTH_MAX_CODE_ATTEMPTS,
    create_jwt,
    generate_otac,
    generate_token,
    get_current_session,
    require_user,
)
from ..database import get_db
from ..email import send_otac_email
from ..models import AuthToken
from ..models import Session as SessionModel
from ..models import User
from ..schemas import AuthResponse, LoginRequest, UserResponse, VerifyRequest

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

AUTH_TOKEN_EXPIRY_MINS = 15
SESSION_EXPIRY_DAYS = 30


@router.post("/login", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower()

    user = db.query(User).filter(User.email == email).first()
    user_id = user.id if user else None

    token = generate_token(32)
    code = generate_otac()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=AUTH_TOKEN_EXPIRY_MINS)

    auth_token = AuthToken(
        user_id=user_id,
        email=email,
        token=token,
        short_code=code,
        expires_at=expires_at,
    )
    db.add(auth_token)
    db.commit()

    await send_otac_email(email, code)

    return {"message": "Code sent"}


@router.post("/verify")
@limiter.limit("10/minute")
async def verify(
    request: Request,
    body: VerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = body.email.lower()
    code = body.code.upper()

    auth_token = (
        db.query(AuthToken)
        .filter(
            AuthToken.email == email,
            AuthToken.used == 0,
            AuthToken.expires_at > datetime.now(timezone.utc),
            AuthToken.short_code.isnot(None),
        )
        .order_by(AuthToken.id.desc())
        .first()
    )

    if not auth_token:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if auth_token.attempts >= AUTH_MAX_CODE_ATTEMPTS:
        auth_token.used = 1
        db.commit()
        raise HTTPException(status_code=400, detail="Too many attempts")

    if not auth_token.short_code or auth_token.short_code.upper() != code:
        auth_token.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid code")

    auth_token.used = 1

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)
        db.flush()

    session_token = generate_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    session = SessionModel(user_id=user.id, token=session_token, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(user)

    jwt_token = create_jwt(session_token)

    is_prod = os.environ.get("PUZZLE_ENV", "dev") == "prod"
    response.set_cookie(
        key="session",
        value=jwt_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        max_age=SESSION_EXPIRY_DAYS * 86400,
    )

    return AuthResponse(
        token=jwt_token,
        user=UserResponse(id=user.id, email=user.email, display_name=user.display_name),
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_session=Depends(get_current_session),
    db: Session = Depends(get_db),
):
    if current_session:
        db.delete(current_session)
        db.commit()

    response.delete_cookie("session")
    return {"message": "Logged out"}


@router.get("/me")
async def me(user=Depends(require_user)):
    return UserResponse(id=user.id, email=user.email, display_name=user.display_name)
