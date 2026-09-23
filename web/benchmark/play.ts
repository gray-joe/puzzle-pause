import { expect, type Page } from '@playwright/test';
import { PuzzlePage } from '../e2e/pages/PuzzlePage';
import { ResultPage } from '../e2e/pages/ResultPage';
import { askModel, type ModelConfig } from './opencodeZen';
import { type BenchmarkResult } from './results';

export type PlayOutcome = Omit<BenchmarkResult, 'model' | 'puzzleType'> & {
    /** The bot had already attempted this puzzle, so there was nothing left to play. */
    alreadyPlayed: boolean;
};

// Page chrome that isn't part of the puzzle: button labels, stats, date, footer note.
const UI_NOISE = /^(>|Solved by:|Average (score|time)|Archived puzzles score|\d{4}-\d{2}-\d{2}$)/;

// The whole puzzle area, not just `puzzle-question` — for grid/rack/clue puzzles that element holds
// only the prompt, with the actual content in sibling elements.
async function readPuzzleText(puzzle: PuzzlePage): Promise<string> {
    const text = await puzzle.shell.innerText();
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !UI_NOISE.test(line))
        .join('\n');
}

function buildPrompt(puzzleText: string): string {
    return [
        'You are playing a daily puzzle game. Below is the text content of the puzzle.',
        'Reply with ONLY the final answer to submit — plain text, no markdown formatting, no explanation.',
        '',
        puzzleText,
    ].join('\n');
}

// Models sometimes wrap the answer in markdown even when told not to (e.g. "**26**"); the app's
// exact-match check won't accept that, so strip common wrapping before submitting.
function cleanAnswer(raw: string): string {
    return raw
        .trim()
        .replace(/^\*\*(.*)\*\*$/, '$1')
        .replace(/^`(.*)`$/, '$1')
        .replace(/^"(.*)"$/, '$1')
        .trim();
}

// Plays the puzzle already loaded on `page`: up to two model attempts, revealing one hint between.
export async function playPuzzle(page: Page, model: ModelConfig): Promise<PlayOutcome> {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);
    await expect(puzzle.shell).toBeVisible();

    // Bot accounts persist, and a puzzle allows one attempt per user, so a repeat run lands on
    // the stored result instead of a playable puzzle. Report it rather than treating the absent
    // answer box as a failure — the existing score already stands.
    if (await result.panel.isVisible()) {
        const panelText = await result.panel.innerText();
        return {
            alreadyPlayed: true,
            // The result panel only congratulates an actual solve; a give-up just reveals it.
            solved: panelText.includes('Congratulations'),
            attempts: 0,
            hintUsed: false,
            modelAnswer: '',
            score: await result.score.innerText().catch(() => null),
        };
    }

    let hintUsed = false;
    let modelAnswer = '';
    let attempts = 0;
    let solved = false;

    for (let attempt = 0; attempt < 2 && !solved; attempt++) {
        modelAnswer = cleanAnswer(await askModel(model, buildPrompt(await readPuzzleText(puzzle))));
        attempts++;

        if (modelAnswer) {
            await puzzle.answerInput.fill(modelAnswer);

            // Submit stays disabled if the input rejected the reply (e.g. numeric-only field given
            // prose) — count that as a wrong attempt rather than hanging on the click.
            const canSubmit = await expect(puzzle.submitBtn)
                .toBeEnabled({ timeout: 2_000 })
                .then(
                    () => true,
                    () => false
                );

            if (canSubmit) {
                await puzzle.submitBtn.click();
                await Promise.race([
                    result.panel.waitFor({ state: 'visible', timeout: 15_000 }),
                    puzzle.feedback.waitFor({ state: 'visible', timeout: 15_000 }),
                ]).catch(() => {});
                solved = await result.panel.isVisible();
            }
        }

        if (!solved && attempt === 0 && (await puzzle.hintBtn.isVisible().catch(() => false))) {
            const before = await readPuzzleText(puzzle);
            await puzzle.revealHint();
            hintUsed = true;
            await expect.poll(() => readPuzzleText(puzzle), { timeout: 5_000 }).not.toBe(before);
        }
    }

    const score = solved ? await result.score.innerText() : null;
    return { alreadyPlayed: false, solved, attempts, hintUsed, modelAnswer, score };
}
