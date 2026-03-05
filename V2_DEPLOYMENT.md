# V2 Deployment Guide — puzzlepause.app

Migration from v1 (C/mongoose + htmx) to v2 (FastAPI + Next.js).

Both versions use the same SQLite database on the same Fly volume (`puzzle_data` → `/app/data/puzzle.db`). The schema is compatible — v2 adds new tables and indexes but does not alter existing tables.

---

## Pre-deploy checklist

- [ ] All tests pass locally (`make v2-test` + `cd web && npx playwright test`)
- [ ] `feat/v2` branch is merged to `main`
- [ ] Fly CLI is authenticated (`fly auth whoami`)
- [ ] You have the required secrets set (check step 3)

---

## 1. Back up the production database

```bash
# SSH into the running v1 machine and copy the database
fly ssh console -a daily-puzzle-app

# Inside the machine:
cp /app/data/puzzle.db /app/data/puzzle.db.v1-backup
ls -la /app/data/
exit

# Download a local copy for safety
fly sftp get /app/data/puzzle.db.v1-backup ./data/prod-backup-$(date +%Y%m%d).db
```

Verify the backup is valid:

```bash
sqlite3 ./data/prod-backup-$(date +%Y%m%d).db "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM puzzles; SELECT COUNT(*) FROM attempts;"
```

---

## 2. Merge the branch

```bash
git checkout main
git merge feat/v2
git push origin main
```

---

## 3. Verify Fly secrets

v2 requires these secrets that v1 did not:

```bash
fly secrets list -a daily-puzzle-app
```

Ensure these are set:

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Signs session JWTs (generate with `openssl rand -hex 32`) |
| `ADMIN_EMAILS` | Comma-separated admin emails (e.g. `you@example.com`) |
| `RESEND_API_KEY` | Email delivery for login codes |

Set any missing secrets:

```bash
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" -a daily-puzzle-app
fly secrets set ADMIN_EMAILS="you@example.com" -a daily-puzzle-app
fly secrets set RESEND_API_KEY="re_xxxxx" -a daily-puzzle-app
```

---

## 4. Deploy

```bash
fly deploy -a daily-puzzle-app
```

This will:
1. Build the multi-stage Docker image (Python backend + Next.js frontend)
2. Replace the running v1 container with v2
3. Mount the existing `puzzle_data` volume at `/app/data`
4. Run `Base.metadata.create_all()` which adds new tables (sessions, auth_tokens, leagues, league_members) without touching existing tables
5. Run `CREATE INDEX IF NOT EXISTS` for performance indexes
6. Start supervisord → uvicorn (port 8000) + Next.js (port 3000)

**Note:** There will be ~30–60s of downtime while the new machine starts.

---

## 5. Post-deploy verification

### Health check

```bash
curl https://puzzlepause.app/api/health
# Expected: {"status":"ok"}
```

### Data integrity

```bash
fly ssh console -a daily-puzzle-app
cd /app/backend
DATABASE_URL=sqlite:////app/data/puzzle.db /venv/bin/python verify_db.py
exit
```

Expected output — your real counts, zero orphaned attempts:

```
Users:          <N>
Puzzles:        <N>
Attempts:       <N>
Leagues:        <N>
League members: <N>
No orphaned attempts — data looks clean
Solved attempts: <N>
Verification complete.
```

### Smoke tests

1. Visit https://puzzlepause.app — daily puzzle loads
2. Log in with an admin email — verify code arrives, login works
3. Check /admin — dashboard shows correct stats
4. Check /archive — past puzzles visible
5. Check /leagues — leagues load (will be empty for new users)
6. Check /account — stats display correctly

### Verify indexes were created

```bash
fly ssh console -a daily-puzzle-app
sqlite3 /app/data/puzzle.db ".indexes"
exit
```

Should include: `ix_attempts_user_solved`, `ix_attempts_puzzle_id`, `ix_league_members_user_id`, `ix_league_members_league_id`, `ix_auth_tokens_email_used_expires`.

---

## 6. Rollback (if needed)

If something is wrong, restore v1:

```bash
# Revert main to the pre-merge commit
git revert HEAD --no-edit
git push origin main

# Redeploy v1
fly deploy -a daily-puzzle-app

# If the database was corrupted, restore the backup
fly ssh console -a daily-puzzle-app
cp /app/data/puzzle.db.v1-backup /app/data/puzzle.db
exit

# Restart to pick up restored DB
fly apps restart daily-puzzle-app
```

---

## Key differences: v1 → v2

| | v1 | v2 |
|---|---|---|
| Backend | C / mongoose | Python / FastAPI |
| Frontend | htmx (server-rendered) | Next.js (SSR + client) |
| Internal port | 8080 | 3000 |
| Process manager | single binary | supervisord (2 processes) |
| Auth | cookie-based sessions | JWT in httponly cookie |
| Memory | 256 MB | 512 MB |
| Database | same SQLite file | same SQLite file + new tables + indexes |
| Health check | none | `/api/health` every 30s |
