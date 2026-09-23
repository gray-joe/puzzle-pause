import { test, expect } from '@playwright/test';
import { benchmarkLoginAs } from './login';
import { type ModelConfig } from './opencodeZen';
import { playPuzzle } from './play';
import modelsConfig from './models.config.json';

// Ad-hoc run against a single puzzle URL (local or live) as the persistent bot accounts, no DB
// seeding needed. Usage: BENCHMARK_URL=https://puzzlepause.app/archive/232 npx playwright test --project=benchmark-single
// The missing-URL case skips rather than throwing at module scope, so collecting every project
// (bare `playwright test`, `--list`, `--ui`, the VS Code extension) still works without it set.
const url = process.env.BENCHMARK_URL;

const models = modelsConfig.models as ModelConfig[];

for (const model of models) {
    test(`${model.account} solves ${url ?? 'BENCHMARK_URL (unset)'}`, async ({ page }) => {
        test.skip(
            !url,
            'Set BENCHMARK_URL to the full puzzle URL, e.g. BENCHMARK_URL=https://puzzlepause.app/archive/232'
        );
        const puzzleUrl = url!;

        await benchmarkLoginAs(page, new URL(puzzleUrl).origin, model);
        await page.goto(puzzleUrl);

        const outcome = await playPuzzle(page, model);
        console.log(
            `[${model.label}] alreadyPlayed=${outcome.alreadyPlayed} solved=${outcome.solved} attempts=${outcome.attempts} hintUsed=${outcome.hintUsed} answer="${outcome.modelAnswer}" score=${outcome.score}`
        );

        test.skip(
            outcome.alreadyPlayed,
            `${model.label} already played this puzzle (score ${outcome.score})`
        );

        expect(
            outcome.solved,
            `${model.label} did not solve the puzzle (last answer: "${outcome.modelAnswer}")`
        ).toBeTruthy();
    });
}
