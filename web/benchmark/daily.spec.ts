import { test } from '@playwright/test';
import { benchmarkLoginAs } from './login';
import { type ModelConfig } from './opencodeZen';
import { inspectPuzzle, playPuzzle } from './play';
import modelsConfig from './models.config.json';

// Has each bot play today's daily puzzle, so they appear on a league's today/weekly boards
// (those join on the current puzzle date, which archive attempts never match).
//
// Usage: make benchmark-daily [BASE_URL=https://puzzlepause.app]
//
// Deliberately does not fail when a model gets the puzzle wrong: this is a participation job
// meant to run unattended, and a bot losing is normal gameplay, not a broken run. Real problems
// (login rejected, model API down) still throw.
const baseUrl = process.env.BENCHMARK_BASE_URL ?? 'http://localhost:3000';

const models = modelsConfig.models as ModelConfig[];

// The daily page omits the archive page's type marker, so take the type from the API. This also
// gives a clean read on whether a puzzle is published at all (404 before 09:00 UTC).
async function fetchTodaysType(): Promise<string | null> {
    const res = await fetch(`${baseUrl}/api/puzzle/today`);
    if (!res.ok) return null;
    return ((await res.json()) as { puzzle_type?: string }).puzzle_type ?? 'unknown';
}

for (const model of models) {
    test(`${model.account} plays today's puzzle`, async ({ page }) => {
        const todaysType = await fetchTodaysType();
        test.skip(todaysType === null, 'No puzzle published for today');

        await benchmarkLoginAs(page, baseUrl, model);
        await page.goto(`${baseUrl}/puzzle`);

        const { playable, reason } = await inspectPuzzle(page);
        test.skip(!playable, `today's puzzle is "${todaysType}" — ${reason}`);

        const outcome = await playPuzzle(page, model);
        console.log(
            `[${model.label}] type=${todaysType} alreadyPlayed=${outcome.alreadyPlayed} solved=${outcome.solved} guesses=${outcome.guesses} rejected=${outcome.rejected} hintUsed=${outcome.hintUsed} gaveUp=${outcome.gaveUp} answer="${outcome.modelAnswer}" score=${outcome.score}`
        );
    });
}
