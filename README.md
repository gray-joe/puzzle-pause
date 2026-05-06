# Puzzle Pause

A daily puzzle web app where users solve word, math, and logic puzzles and compete in mini leagues.

## Tech Stack

- **Backend**: Python (FastAPI, SQLAlchemy, SQLite)
- **Frontend**: Next.js with Tailwind CSS
- **Deployment**: fly.io with persistent volume for SQLite

## Prerequisites

- Python 3.13
- Node.js 22

## Setup

1. **Backend**:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Frontend**:
   ```bash
   cd web
   npm install
   ```

## Development

Run the backend and frontend separately:

```bash
# Backend (from backend/)
uvicorn app.main:app --reload

# Frontend (from web/)
npm run dev
```

## Testing

### Backend

```bash
# Install dev dependencies
pip install -r backend/requirements-dev.txt

# Run tests (with coverage — output to terminal and htmlcov/)
cd backend && python -m pytest

# Via Makefile
make backend-test
```

Coverage report is written to `backend/htmlcov/`.

### Frontend — unit tests (Vitest)

```bash
cd web && npm test

# Watch mode
cd web && npm test -- --watch
```

Tests run in a `happy-dom` environment and exclude the `e2e/` directory.

### Frontend — end-to-end tests (Playwright / Chromium)

The e2e suite requires the dev servers to be running first.

```bash
# 1. Start backend and frontend (in separate terminals)
make backend-run
make web-run

# 2. Run Playwright tests
make web-test
# or with extra Playwright args, e.g. --headed
make web-test ARGS="--headed"
# or directly
cd web && npm run test:e2e
```

Reports land in `web/playwright-report/`.

## Linting

### Frontend (ESLint via Next.js)

```bash
cd web && npm run lint
```

### Backend (Pyright type checking)

```bash
cd backend && pyright
```

`pyrightconfig.json` points Pyright at the `.venv` virtualenv.

## Project Structure

```
daily_puzzle_app/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app entry point
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── auth.py         # Authentication logic
│   │   ├── routers/        # API route handlers
│   │   └── database.py     # Database configuration
│   ├── tests/
│   ├── alembic/            # Database migrations
│   └── requirements.txt
├── web/                    # Next.js frontend
├── Dockerfile
├── supervisord.conf
├── fly.toml
├── SPEC.md
└── CLAUDE.md
```

## Deployment

Deployed on fly.io using a multi-stage Docker build. Supervisord runs both the backend (uvicorn) and frontend (Next.js standalone) in a single container.

```bash
fly deploy
```

### Sentry

Sentry is optional and is disabled unless DSN values are provided.

- Backend runtime errors: set `SENTRY_DSN`.
- Browser/client reporting: provide `NEXT_PUBLIC_SENTRY_DSN` at Docker build time.
- Next.js server/edge runtime errors: optionally set `SENTRY_NEXT_DSN`; otherwise they use `NEXT_PUBLIC_SENTRY_DSN` when present.
- Optional shared metadata: `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `NEXT_PUBLIC_SENTRY_RELEASE`.
- Optional trace sampling: `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
- Optional frontend source-map uploads during build: provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as build args or CI secrets.
