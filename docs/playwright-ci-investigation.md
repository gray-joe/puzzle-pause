# Playwright CI Run Options — Investigation (PUZ-12)

Investigation of running Playwright e2e tests in GitHub Actions: **ephemeral dev stack on the CI runner** vs **hosted staging environment**.

## Executive summary

**Recommendation: spin up an ephemeral dev stack inside the GitHub Actions job.**

The puzzle-pause e2e suite is already designed for a local SQLite database shared between the backend and Playwright helpers. Seeding is built in (`global.setup.ts` → `seed_dev.py`). A CI job that starts the backend and frontend on the runner, then runs Playwright, is feasible, matches local development, and avoids the major blockers of a shared staging environment.

A hosted staging target is possible only with substantial test refactors (auth helpers, DB seeding over the network, isolation between concurrent runs) and ongoing infra cost. It does not fit the current architecture well.

| Criterion | Ephemeral dev stack (GHA) | Hosted staging |
| --- | --- | --- |
| Feasibility | **High** — minimal changes | **Low** — requires refactors + new infra |
| Data seeding | Already handled (`seed_dev.py` in global setup) | Must run remotely before every job; no existing mechanism |
| Auth/login tests | Works today (reads OTAC from local SQLite) | **Blocked** — tests read `auth_tokens` via `better-sqlite3` |
| Test isolation | Full — fresh DB per run | Poor — shared DB, mutating admin/league tests conflict |
| Infra cost | GHA minutes only | Dedicated fly.io app + volume (~$5–10+/mo) |
| Prod fidelity | Dev mode (`PUZZLE_ENV=dev`); optional `next build` + `next start` | Closer to prod deploy, but still needs seeding |
| Estimated job time | ~4–7 min (see below) | Similar test time + remote seed latency + flakiness |

---

## Current state

### CI today

`.github/workflows/ci.yml` runs:

- Backend unit tests (`pytest -m unit`)
- Backend API tests (`pytest -m api`)
- Backend lint/format/typecheck
- Web unit tests (Vitest)
- Web lint/format/typecheck

**Playwright e2e is not in CI.** It runs locally via `make web-test` with backend and frontend already running.

### E2e suite size

- **22 spec files**, **134 tests** (measured 2026-08-13)
- Playwright config (`web/playwright.config.ts`):
  - `baseURL`: `http://localhost:3000`
  - CI: `workers: 1`, `retries: 2`, `forbidOnly: true`
  - `setup_db` project runs `global.setup.ts` before chromium tests

### Local run requirements

From `README.md` and `Makefile`:

1. Backend on `http://localhost:8000` with env:
   - `DATABASE_URL=sqlite:///$(pwd)/data/puzzle.db`
   - `JWT_SECRET=dev-secret`
   - `RATELIMIT_ENABLED=0`
   - `PUZZLE_ENV=dev`
   - `ADMIN_EMAILS=admin@example.com`
2. Frontend on `http://localhost:3000` with `API_URL=http://localhost:8000`
3. Playwright seeds DB via `global.setup.ts` before tests

### How seeding works

`web/e2e/global.setup.ts` runs `backend/seed_dev.py` against `data/puzzle.db`:

- Drops and recreates all tables
- Seeds 26 puzzles (relative dates), 9 users, 3 leagues, attempts, completion events
- Adds “today’s” puzzle dynamically via `get_puzzle_date()`

This is a **full reset** — ideal for CI isolation.

### How auth works in tests

In dev (`PUZZLE_ENV != prod`), login codes are printed to stdout (`backend/app/email.py`) instead of sent via Resend.

Tests **do not read stdout**. They use `web/e2e/helpers/db.ts`:

- `better-sqlite3` opens `data/puzzle.db` directly
- `getLoginCode()` reads `auth_tokens.short_code` from SQLite
- `loginAs()` POSTs to `/api/auth/login` and `/api/auth/verify`, then sets the session cookie

Several tests also **write** to SQLite directly (`createPuzzleWithCompletionEvent`, league/user lookups).

This local-DB coupling is the main architectural constraint for staging-based CI.

---

## Option A: Ephemeral dev stack in GitHub Actions

### Approach

In a single `ubuntu-latest` job:

1. Check out repo
2. Set up Python 3.13 and Node 22 (same as existing CI jobs)
3. Install backend (`pip install -r requirements-dev.txt`) and web (`npm ci`) dependencies
4. Install Playwright Chromium: `npx playwright install --with-deps chromium`
5. `mkdir -p data`
6. Start backend in background (uvicorn on port 8000)
7. Start frontend in background (`npm run dev` or `npm run build && npm run start`)
8. Wait for health (`/api/health`, `/`)
9. Run `CI=1 npm run test:e2e` from `web/`
10. Upload `playwright-report/` and `test-results/` on failure

### Measured runtime (local CI-mode run)

On a clean run with servers already up:

| Phase | Duration |
| --- | --- |
| DB seed (global setup) | ~2 s |
| 134 tests (1 worker, CI retries enabled) | **~1.7 min** |
| **Total test command** | **~105 s** |

Expected **full GHA job** (including dependency install and server startup):

| Phase | Estimated duration |
| --- | --- |
| Checkout + Python/Node setup (cached) | ~30–60 s |
| `pip install` + `npm ci` (cached) | ~60–90 s |
| Playwright browser install | ~30–60 s |
| Server startup (`next dev` first compile) | ~30–90 s |
| E2e tests | ~2–3 min (includes retries) |
| **Total** | **~4–7 min** |

Using `next build` + `next start` instead of `next dev` adds ~1–3 min but better matches production.

### Pros

- **No new infrastructure**
- **Matches local dev workflow** documented in README/Makefile
- **Seeding already automated** — no new seed API needed
- **Auth tests work unchanged** — SQLite is on the runner filesystem
- **Full isolation** — each run gets a fresh DB; admin CRUD and league tests can mutate state safely
- **Parallel PRs** do not interfere with each other
- **Same secrets surface** as existing CI (none required for e2e)

### Cons / gaps

- Runs in **dev mode**, not the production Docker/supervisord layout (unless job builds and runs the Docker image — see Option A variant below)
- `next dev` differs from production Next.js standalone (`Dockerfile` / `supervisord.conf`)
- External puzzle images (S3 URLs in seed data) require network egress during tests
- One landing-page test failed in the investigation run (`start-puzzle-link` not found) — likely a product/test drift issue to fix before enabling CI gating

### Optional variants

**A1 — Playwright `webServer` (config-only improvement)**

`playwright.config.ts` could start backend + frontend via `webServer` entries so `npm run test:e2e` is self-contained. Still ephemeral/local SQLite.

**A2 — Production-like Docker job**

Build the multi-stage `Dockerfile`, run supervisord, seed via `fly ssh`-style exec or mounted volume. **Problem:** Playwright helpers still need filesystem access to `puzzle.db` inside the container unless refactored. Would require either:

- Mounting `data/` from container to runner, or
- Refactoring auth helpers away from direct SQLite access

Not worth it for initial CI unless prod-layout validation is a explicit goal.

### Proposed workflow sketch

```yaml
web-e2e-tests:
  name: Web E2E Tests (Playwright)
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: web
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-python@v5
      with:
        python-version: "3.13"
        cache: pip
        cache-dependency-path: backend/requirements-dev.txt

    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: npm
        cache-dependency-path: web/package-lock.json

    - name: Install backend dependencies
      working-directory: backend
      run: pip install -r requirements-dev.txt

    - name: Install frontend dependencies
      run: npm ci

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Start backend
      working-directory: backend
      run: |
        mkdir -p ../data
        DATABASE_URL=sqlite:///${{ github.workspace }}/data/puzzle.db \
        JWT_SECRET=dev-secret \
        RATELIMIT_ENABLED=0 \
        PUZZLE_ENV=dev \
        ADMIN_EMAILS=admin@example.com \
        uvicorn app.main:app --port 8000 &
        for i in $(seq 1 30); do curl -sf http://localhost:8000/api/health && break; sleep 2; done

    - name: Start frontend
      run: |
        API_URL=http://localhost:8000 ADMIN_EMAILS=admin@example.com npm run dev &
        for i in $(seq 1 60); do curl -sf http://localhost:3000 && break; sleep 2; done

    - name: Run Playwright e2e tests
      run: npm run test:e2e
      env:
        CI: true

    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: web/playwright-report/
```

---

## Option B: Hosted staging environment

### Approach

Deploy a persistent staging app (e.g. second fly.io app `daily-puzzle-staging`) and point Playwright at `https://staging.puzzlepause.app` (or similar). Run `seed_dev.py` before each CI job to reset data.

### Blockers

#### 1. Direct SQLite access in test helpers

`web/e2e/helpers/db.ts` hardcodes:

```ts
const DB_PATH = path.resolve(__dirname, '../../../data/puzzle.db');
```

Used for:

- Login code retrieval (`getLoginCode`, `loginAs`)
- Direct DB inserts (`createPuzzleWithCompletionEvent`)
- User/league lookups (`getUserByEmail`, `getLeagueById`, …)

Against remote staging, the SQLite file lives on the fly volume (`/app/data/puzzle.db`). The CI runner cannot read it unless you:

- Add a **test-only HTTP endpoint** to expose OTAC codes (security-sensitive; must never reach prod)
- **SFTP/SSH** the DB file off the machine before each test (slow, brittle)
- Refactor all helpers to use **public APIs only** and a **mail capture** service for login codes

#### 2. Remote seeding

`seed_dev.py` must run **on the staging machine** (or against its DB file):

```bash
fly ssh console -a daily-puzzle-staging -C "cd /app/backend && DATABASE_URL=sqlite:////app/data/puzzle.db python seed_dev.py"
```

Or add an authenticated admin “reset test data” endpoint. Neither exists today.

#### 3. Shared mutable state

Tests create/edit/delete puzzles (admin CRUD), create users, modify leagues. With a **shared** staging DB:

- Concurrent PR workflows overwrite each other’s data
- Serializing all e2e jobs globally is slow and still racy with manual staging use
- Would need per-run isolated databases or namespaces (not supported by current schema)

#### 4. Auth cookie domain

`loginAs()` sets cookies for `domain: 'localhost'`. Would need env-driven domain for staging URLs.

#### 5. Cost and ops

- Always-on fly machine + volume
- Staging secrets (`JWT_SECRET`, `RESEND_API_KEY` or dev-mode bypass)
- Monitoring, deploy pipeline for staging
- Seeding before **every** run even when no e2e job ran

### Pros

- Tests the **real deployed stack** (supervisord, production Next standalone, fly networking)
- Could double as a manual QA environment

### Cons

- High implementation cost for test refactors
- Shared-state / isolation problems
- Ongoing hosting cost
- Slower and flakier than local stack
- Seeding still required every run — same `seed_dev.py` logic, harder to invoke

### When staging e2e might make sense

- As a **post-deploy smoke suite** (small, read-only, API-based auth) — not the full 134-test suite
- After refactoring e2e helpers to be **environment-agnostic** (no direct SQLite)
- With **dedicated staging per branch** (expensive) or **scheduled** runs only

---

## Recommendation

1. **Add Playwright to CI using Option A** (ephemeral dev stack). Low risk, aligns with existing tooling, ~4–7 min job time.
2. **Fix the landing page test drift** before making e2e a required check.
3. **Defer staging-based e2e** until/unless there is a separate requirement to validate the production deploy artifact. If needed later, start with a small smoke subset and refactor auth off direct SQLite access first.
4. **Optional follow-ups** (separate tickets):
   - Playwright `webServer` config to simplify local + CI startup
   - `next build` + `next start` in CI for closer prod fidelity
   - Nightly deploy + smoke against staging (5–10 critical paths)

---

## Files referenced

| File | Relevance |
| --- | --- |
| `.github/workflows/ci.yml` | Current CI — no e2e yet |
| `web/playwright.config.ts` | Base URL, CI workers/retries, setup project |
| `web/e2e/global.setup.ts` | Runs `seed_dev.py` before tests |
| `web/e2e/helpers/db.ts` | Direct SQLite access — staging blocker |
| `backend/seed_dev.py` | Full DB reset + seed data |
| `Makefile` | Local dev/e2e commands |
| `Dockerfile` / `supervisord.conf` | Production layout (fly.io) |
| `fly.toml` | Production deploy config |

---

## Verification performed

- Installed backend and web dependencies on investigation runner
- Started backend (uvicorn) and frontend (`next dev`) with Makefile-equivalent env vars
- Ran `CI=1 npm run test:e2e`: **133/134 passed** in ~1.7 min (1 worker)
- Confirmed `global.setup.ts` seeds DB successfully at start of run
- Reviewed CI workflow, auth flow, and staging deployment config for constraints
