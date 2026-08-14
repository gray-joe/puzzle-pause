# Puzzle Pause

A daily puzzle web app where users solve word, math, image, and logic puzzles and compete in mini leagues.

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
    pip install -r requirements-dev.txt
    ```

2. **Frontend**:
    ```bash
    cd web
    npm install
    ```

## Development

Run the backend and frontend from the repository root in separate terminals:

```bash
# Backend API on http://localhost:8000
make backend-run

# Frontend on http://localhost:3000
make web-run
```

The Makefile sets the local development environment variables used by auth, admin pages, API routing, and the SQLite database. Local data is stored in `data/puzzle.db`.

To seed local puzzle data:

```bash
make seed-dev
```

Useful local environment variables:

- `DATABASE_URL`: SQLite database path. The Makefile uses `sqlite:///$(pwd)/data/puzzle.db`.
- `JWT_SECRET`: required by backend auth token signing.
- `ADMIN_EMAILS`: comma-separated emails that can access admin pages.
- `API_URL`: backend URL used by the Next.js app for server-side API calls and rewrites.
- `BASE_URL`: public app URL used in login emails.
- `CORS_ORIGINS`: comma-separated browser origins accepted by the backend.
- `RESEND_API_KEY`: required for production login email delivery.
- `NEXT_PUBLIC_SITE_URL`: public frontend URL used for metadata.

## Testing

### Backend

```bash
# Install dev dependencies from backend/
pip install -r requirements-dev.txt

# Run tests from backend/ (with coverage output to terminal and htmlcov/)
python -m pytest

# Via Makefile from the repository root
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
Use the Makefile commands so the backend and Playwright tests share `data/puzzle.db`.

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

See [docs/e2e-coverage.md](docs/e2e-coverage.md) for a coverage matrix of puzzle types and app areas.

## Linting

### Frontend (ESLint with Next.js config)

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
│   ├── pytest.ini
│   ├── requirements.txt
│   └── requirements-dev.txt
├── web/                    # Next.js frontend
├── Dockerfile
├── supervisord.conf
├── fly.toml
└── Makefile
```

The backend currently creates database tables and indexes at startup with SQLAlchemy. There is no Alembic migration directory in this repo.

## Deployment

Deployed on fly.io using a multi-stage Docker build. Supervisord runs both the backend (uvicorn) and frontend (Next.js standalone) in a single container.

```bash
fly deploy
```

Use `make fly-deploy` when deploying with frontend Sentry source-map upload build arguments.

### CI deployment

Merges to `main` automatically deploy to fly.io after CI passes. Configure these GitHub repository secrets before enabling deploys:

| Secret | Purpose |
| --- | --- |
| `FLY_API_TOKEN` | Authenticates `fly deploy` in CI |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser Sentry DSN passed as a Docker build arg |
| `SENTRY_AUTH_TOKEN` | Uploads frontend source maps during the Docker build |
| `SENTRY_ORG` | Sentry organization for source-map upload |
| `SENTRY_PROJECT` | Sentry project for source-map upload |

Runtime Sentry settings for the backend (`SENTRY_DSN`, etc.) remain configured as fly.io secrets, not in GitHub Actions.

### Sentry

- Backend runtime errors: set `SENTRY_DSN`.
- Browser/client reporting: provide `NEXT_PUBLIC_SENTRY_DSN` at Docker build time.
- Next.js server/edge runtime errors: optionally set `SENTRY_NEXT_DSN`; otherwise they use `NEXT_PUBLIC_SENTRY_DSN` when present.
- Shared metadata: `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `NEXT_PUBLIC_SENTRY_RELEASE`.
- Release tracking: `make fly-deploy` uses the current git SHA for the frontend build, source-map upload, and backend runtime `SENTRY_RELEASE`.
- Trace sampling: `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
- Frontend source-map uploads during build: provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as build args or CI secrets.
