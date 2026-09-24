# Model benchmark

Drives real puzzle pages with Playwright, asks a model (via [OpenCode Zen](https://opencode.ai/docs/zen/))
for an answer, and submits it through the UI like a real player would. Logs in as a real account (via
`/auth/benchmark-login`, see below) so scores show up in the app's own stats — same scoring as a human
player, since it comes straight from the result panel.

The model is given the text of the whole puzzle area (grid, rack, clues, etc. — not just the prompt)
and plays it the way a person would, up to three guesses:

1. Guess. If it's right, done.
2. Wrong once → guess again, told which answers it already got wrong so it doesn't repeat them.
3. Wrong twice → reveal the hint if the puzzle has one, then take a final guess.
4. Wrong three times → give up.

Wrong guesses cost 5 points each and a hint 10 (archive puzzles then take a further -10), so the
recorded score reflects how much help the model needed rather than just pass/fail.

Covers the 6 text-readable puzzle types with a single answer box: word, math, wordsearch, numgrid,
scrabble, clue-reveal. Not covered:

- `ladder` — has the same `answer-input` testid but renders one input per blank, which the
  single-field flow can't drive.
- `image-word` — the puzzle is an image; needs a vision input, not text.
- Types with other custom interactions (choice, connections, order, match, countdown, word-wheel,
  image-tap, image-order, chess, word-ladder-v2).

Layout is lossy in the text form (e.g. a numgrid arrives as a flat list of cells, scrabble's board and
rack as consecutive lines), so scores for those types partly measure that, not just the model.

## The bot accounts

One persistent account per model, not one per run — so scores accumulate and the bots can sit in a
league. The account is keyed off `account` in `models.config.json`, deliberately separate from the
model `id`: swapping `claude-sonnet-5` for a newer Claude keeps the same player and its history.

| `account` | Email                                  | League name (`label`) |
| --------- | -------------------------------------- | --------------------- |
| `claude`  | `claude@benchmark.puzzlepause.invalid` | Claude                |
| `gpt`     | `gpt@benchmark.puzzlepause.invalid`    | GPT                   |
| `grok`    | `grok@benchmark.puzzlepause.invalid`   | Grok                  |

`label` is pushed to the account's `display_name` on every login, so leagues show "Claude" rather
than the raw email, and renaming in config renames the league entry.

A puzzle keeps one attempt row per user, holding the cumulative guess/hint state, and it's closed
once the puzzle is solved or given up. Since the accounts persist, re-running a puzzle a bot has
finished is a no-op: the run reports `alreadyPlayed`, skips the test, makes no model call, and
leaves the standing score alone. A half-finished attempt is still playable and just resumes.

### Login, no real email

`POST /auth/benchmark-login` (`backend/app/routers/auth.py`) skips the emailed one-time code. Locked
down two ways:

- Requires a header `X-Benchmark-Secret` matching the server's `BENCHMARK_BYPASS_SECRET` env var. If
  that env var isn't set, the route always rejects — so it does nothing unless deliberately enabled.
- Only ever creates/logs into accounts on the reserved `@benchmark.puzzlepause.invalid` domain (RFC 2606
  — guaranteed non-deliverable), so a leaked secret can never be used to log into a real user's account.

### Where they show up

- **League standings: yes** — that's the point. Membership-scoped, so they only appear in leagues you
  add them to.
- **Their own `/account` stats: yes.**
- **A puzzle's "Solved by %" / "Average score" / "Average time": no** — excluded in
  `_puzzle_completion_stats`, so bot runs don't skew the numbers real players see.
- **Admin dashboard raw counts: yes** — it's an ops view, so it reports true totals.

## Putting the bots in a league

```bash
make benchmark-join-league CODE=ABC123                              # local
make benchmark-join-league CODE=ABC123 BASE_URL=https://puzzlepause.app
```

Each bot logs in and joins via the app's own `/leagues/join`, so no direct DB writes. Idempotent —
safe to re-run.

Note the today/weekly leaderboards join on the current puzzle date, so **archive** attempts only show
on the all-time board. Use the daily run below to get the bots onto the daily boards.

## Today's puzzle

```bash
make benchmark-daily                                    # local
make benchmark-daily BASE_URL=https://puzzlepause.app
```

This is what feeds a league's today/weekly boards, and daily puzzles have no archive deduction, so
a clean solve is worth the full 100.

Today's puzzle can be any of the 16 types, so the run checks before playing and skips when it can't
drive it — no puzzle published yet (before 09:00 UTC), a type with no text answer box, or a
multi-box type. Opening the page does create an empty attempt row on a skipped day, the same as a
person opening a puzzle and not finishing; it stays resumable and scores nothing.

Unlike the other runs, this one **does not fail when a model gets the puzzle wrong** — it's a
participation job meant to run unattended, where a bot losing is normal gameplay rather than a
broken run. Genuine faults (login rejected, model API down) still fail loudly.

To run it every day, point a scheduler at `make benchmark-daily` after 09:00 UTC. Re-running the
same day is harmless: finished puzzles report `alreadyPlayed` and make no model calls.

## Setup

1. Add to `web/.env.local`:

    ```
    OPENCODE_API_KEY=sk-...
    BENCHMARK_BYPASS_SECRET=dev-benchmark-secret
    ```

    `make backend-run` reads this value from `.env.local` and passes it to the local
    backend, so the value above works out of the box against `localhost`.

    To benchmark against **production**, set a secret there once:

    ```bash
    flyctl secrets set BENCHMARK_BYPASS_SECRET=<a long random value>
    ```

    Then put that same value in `web/.env.local` as `BENCHMARK_BYPASS_SECRET`, replacing the dev
    default. It is never passed on a command line — secrets routinely contain `&`, `$` or other
    shell metacharacters, and a `VAR=value` prefix would split the command on them. Instead:
    - Playwright reads it from `.env.local` via `dotenv` (`playwright.config.ts`).
    - `make backend-run` reads it from the same file, so the local backend and the harness can't
      disagree. If the variable is absent it falls back to `dev-benchmark-secret`.

    So one value in one file serves both local and production runs, and the commands below need
    no secret argument at all.

2. Edit `models.config.json` to list the models to benchmark. Each entry needs:
    - `account`: stable bot-account key — the email local part and the identity in a league. Keep it
      stable across model upgrades so the player's history carries over.
    - `label`: the bot's league display name, and its label in reports
    - `id`: the raw OpenCode Zen model id, exactly as listed at `https://opencode.ai/zen/v1/models`
      (no `opencode/` prefix — that alias is only for the opencode CLI/TUI config, not this HTTP API)
    - `endpoint`: which OpenCode Zen endpoint to call for that model
    - `format`: `openai-chat` (`/v1/chat/completions`, `Authorization: Bearer` header), `openai-responses`
      (`/v1/responses`, `Authorization: Bearer` header), or `anthropic-messages` (`/v1/messages`,
      `x-api-key` + `anthropic-version` headers) — must match the endpoint

## Single puzzle (local or live)

Run one puzzle URL against every configured model, each as its persistent bot account:

```bash
make benchmark-puzzle URL=http://localhost:3000/archive/2
make benchmark-puzzle URL=https://puzzlepause.app/archive/232
```

Only works for the plain-text-answer puzzle types (see above). Unlike the daily run, this one
doesn't pre-check the type, so for anything outside the local seed set confirm the page has exactly
one `data-testid="answer-input"` first:

```bash
curl -s https://puzzlepause.app/archive/232 | grep -c 'data-testid="answer-input"'
```

## Run (local matrix — all models × all 6 puzzle types)

```bash
make backend-run   # terminal 1
make web-run       # terminal 2
make benchmark-run # terminal 3
```

Prints a Markdown table (model × puzzle type → solved/score) to stdout. Raw per-attempt results are
in `results/latest.jsonl` (overwritten each run) and the standard Playwright HTML report at
`playwright-report/` shows pass/fail plus traces for any puzzle a model failed to solve.
