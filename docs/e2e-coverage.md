# E2E Test Coverage

Playwright end-to-end tests live in `web/e2e/`. The suite seeds `data/puzzle.db` via `global.setup.ts` before running, so archive puzzle IDs are stable across runs.

Run locally:

```bash
make backend-run   # terminal 1
make web-run       # terminal 2
make web-test      # terminal 3
```

CI runs the same suite in `.github/workflows/ci.yml` (`web-e2e-tests` job).

## Puzzle types

All 16 player-facing puzzle types now have dedicated archive specs. Seed archive IDs are listed for reference.

| Puzzle type   | Spec file              | Archive ID | Covered flows |
|---------------|------------------------|------------|---------------|
| word          | `word.spec.ts`         | 2          | render, validation, wrong guess, hint, solve |
| math          | `math.spec.ts`         | 12         | render, numeric input, wrong guess, hint, solve |
| ladder        | `ladder.spec.ts`       | 5          | render, blanks, validation, wrong guess, hint, solve |
| choice        | `choice.spec.ts`       | 17         | render, wrong/correct option, hint, solve |
| wordsearch    | `wordsearch.spec.ts`   | 18         | render, uppercase input, wrong guess, hint, solve |
| word-wheel    | `word-wheel.spec.ts`   | 19         | render, dual inputs, Enter submit, hint, solve |
| connections   | `connections.spec.ts`  | 20         | render, grouping, wrong/correct submit, solve |
| order         | `order.spec.ts`        | 21         | render, reorder, wrong/correct submit, solve |
| image-tap     | `image-tap.spec.ts`    | 22         | render, tap, wrong submit, hint |
| image-order   | `image-order.spec.ts`  | 23         | render, hint, solve |
| countdown     | `countdown.spec.ts`    | 24         | render, expression building, show total, hint, solve |
| clue-reveal   | `clue-reveal.spec.ts`  | 25         | render, progressive clues, wrong guess, solve |
| image-word    | `image-word.spec.ts`   | 26         | render, wrong guess, solve |
| numgrid       | `numgrid.spec.ts`      | 6          | render, numeric input, hint, solve |
| match         | `match.spec.ts`        | 7          | render, pairing, wrong/correct submit, solve |
| scrabble      | `scrabble.spec.ts`     | 11         | render, modifiers, hint, solve |

Admin puzzle builders for every type (including `clue-reveal` and `image-word`) are covered in `admin.spec.ts`.

## App areas

| Area | Spec file | Notes |
|------|-----------|-------|
| Landing page | `landing.spec.ts` | Guest calendar and login prompt |
| Login | `login.spec.ts` | New/existing user login, invalid email |
| Daily puzzle | `puzzle.spec.ts` | Solve, hint, give up, scoring |
| Guest play | `guest.spec.ts` | Daily and archive completion, hints |
| Archive list & play | `archive.spec.ts` | Listing, solve, hints, prior results |
| Account | `account.spec.ts` | Stats, edit name, logout, delete account |
| Leagues | `leagues.spec.ts` | List, standings, create/join/leave/delete |
| Admin | `admin.spec.ts` | Access control, dashboard, CRUD, builders, preview, tables |

## Known gaps

These areas are intentionally not covered by Playwright today:

- **Static pages**: `/support`, `/privacy` (content-only pages with no interactive flows).
- **Image-tap solve path**: `image-tap.spec.ts` covers interaction and wrong answers but not a successful tap at the seeded target coordinates.
- **Connections daily puzzle**: archive coverage exists; daily-play flows for connections are only indirectly exercised via guest/admin paths.
- **Mobile browsers**: CI and local config run Chromium desktop only.

When adding a new puzzle type, follow the existing per-type spec pattern and add a seed entry in `backend/seed_dev.py` so archive IDs remain deterministic.
