import { test, expect } from '@playwright/test';
import { benchmarkLoginAs } from './login';
import { type ModelConfig } from './opencodeZen';
import { playPuzzle } from './play';
import { TEXT_PUZZLES } from './puzzles';
import { recordResult } from './results';
import modelsConfig from './models.config.json';

const models = modelsConfig.models as ModelConfig[];

for (const model of models) {
    for (const puzzleCase of TEXT_PUZZLES) {
        test(`${model.account} solves ${puzzleCase.type}`, async ({ page, baseURL }) => {
            await benchmarkLoginAs(page, baseURL!, model);
            await page.goto(`/archive/${puzzleCase.archiveId}`);

            const outcome = await playPuzzle(page, model);
            recordResult({ model: model.account, puzzleType: puzzleCase.type, ...outcome });

            // Each bot account keeps one persistent attempt per puzzle, so a repeat run has
            // nothing to play. Skip rather than re-score what already stands.
            test.skip(
                outcome.alreadyPlayed,
                `${model.label} already played this puzzle (score ${outcome.score})`
            );

            expect(
                outcome.solved,
                `${model.label} did not solve ${puzzleCase.type} (last answer: "${outcome.modelAnswer}")`
            ).toBeTruthy();
        });
    }
}
