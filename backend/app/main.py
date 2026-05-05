import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from sqlalchemy import text as _text

from .database import Base, engine
from .routers import account, admin, archive, auth, leagues, puzzle

Base.metadata.create_all(bind=engine)

# Ensure indexes exist on pre-existing databases (create_all won't add them)
with engine.connect() as _conn:
    for _stmt in [
        "CREATE INDEX IF NOT EXISTS ix_attempts_user_solved ON attempts (user_id, solved)",
        "CREATE INDEX IF NOT EXISTS ix_attempts_puzzle_id ON attempts (puzzle_id)",
        "CREATE INDEX IF NOT EXISTS ix_league_members_user_id ON league_members (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_league_members_league_id ON league_members (league_id)",
        "CREATE INDEX IF NOT EXISTS ix_auth_tokens_email_used_expires ON auth_tokens (email, used, expires_at)",
        "CREATE INDEX IF NOT EXISTS ix_completion_events_completed_at ON puzzle_completion_events (completed_at)",
        "CREATE INDEX IF NOT EXISTS ix_completion_events_source_completed ON puzzle_completion_events (source, completed_at)",
        "CREATE INDEX IF NOT EXISTS ix_completion_events_puzzle_completed ON puzzle_completion_events (puzzle_id, completed_at)",
        "CREATE INDEX IF NOT EXISTS ix_completion_events_user_completed ON puzzle_completion_events (user_id, completed_at)",
        "CREATE INDEX IF NOT EXISTS ix_completion_events_guest_session_completed ON puzzle_completion_events (guest_session_id, completed_at)",
    ]:
        _conn.execute(_text(_stmt))
    _conn.commit()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Puzzle Pause API", version="2.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

_allowed_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Cookie", "Authorization"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(puzzle.router, prefix="/api")
app.include_router(archive.router, prefix="/api")
app.include_router(leagues.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
