import os
from datetime import datetime, timezone

from .sentry import init_sentry

init_sentry()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import inspect as _inspect
from sqlalchemy import text as _text

from .database import Base, engine
from .puzzle import calculate_archive_score
from .routers import account, admin, archive, auth, leagues, puzzle

Base.metadata.create_all(bind=engine)

with engine.connect() as _conn:
    _columns = {column["name"] for column in _inspect(_conn).get_columns("puzzles")}
    if "explanation" not in _columns:
        _conn.execute(_text("ALTER TABLE puzzles ADD COLUMN explanation TEXT"))
        _conn.commit()

with engine.connect() as _conn:
    _columns = {column["name"] for column in _inspect(_conn).get_columns("attempts")}
    if "source" not in _columns:
        _conn.execute(
            _text(
                "ALTER TABLE attempts ADD COLUMN source TEXT NOT NULL DEFAULT 'daily'"
            )
        )
        _conn.commit()
    if "gave_up" not in _columns:
        _conn.execute(
            _text("ALTER TABLE attempts ADD COLUMN gave_up INTEGER NOT NULL DEFAULT 0")
        )
        _conn.commit()

with engine.connect() as _conn:
    _columns = {
        column["name"]
        for column in _inspect(_conn).get_columns("puzzle_completion_events")
    }
    if "gave_up" not in _columns:
        _conn.execute(
            _text(
                "ALTER TABLE puzzle_completion_events "
                "ADD COLUMN gave_up INTEGER NOT NULL DEFAULT 0"
            )
        )
        _conn.commit()


def _parse_dt(value):
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _backfill_archive_attempt_scores() -> None:
    with engine.connect() as _conn:
        rows = _conn.execute(
            _text(
                "SELECT a.id, a.opened_at, a.completed_at, a.incorrect_guesses, a.hint_used "
                "FROM attempts a JOIN puzzles p ON a.puzzle_id = p.id "
                "WHERE a.solved = 1 AND COALESCE(a.gave_up, 0) = 0 "
                "AND COALESCE(a.score, 0) = 0 "
                "AND p.puzzle_date < date('now')"
            )
        ).fetchall()
        for row in rows:
            opened_at = _parse_dt(row[1])
            completed_at = _parse_dt(row[2]) or opened_at or datetime.now(timezone.utc)
            score = calculate_archive_score(
                opened_at, completed_at, row[3] or 0, row[4] or 0
            )
            _conn.execute(
                _text(
                    "UPDATE attempts SET score = :score, source = 'archive' WHERE id = :id"
                ),
                {"score": score, "id": row[0]},
            )
        if rows:
            _conn.commit()


_backfill_archive_attempt_scores()

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
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_completion_events_guest_give_up "
        "ON puzzle_completion_events (puzzle_id, guest_session_id) "
        "WHERE gave_up = 1 AND guest_session_id IS NOT NULL",
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
