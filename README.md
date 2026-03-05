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

```bash
cd backend
pip install pytest pytest-cov
python -m pytest
```

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
