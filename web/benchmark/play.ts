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

function buildPrompt(puzzleText: string, triedAnswers: string[]): string {
    return [
        'You are playing a daily puzzle game. Below is the text content of the puzzle.',
        'Reply with ONLY the final answer to submit — plain text, no markdown formatting, no explanation.',
        // Without this a model just repeats its last rejected answer, making retries pointless.
        // "not accepted" covers both a wrong answer and one the input field refused.
        ...(triedAnswers.length
            ? [
                  `These were already tried and not accepted: ${triedAnswers.join(', ')}.`,
                  'Give a different answer.',
              ]
            : []),
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

/** Guesses allowed before giving up. The app itself is unlimited; this is the bot's budget. */
const MAX_GUESSES = 3;

export interface PuzzleInspection {
    /** From the archive page's hidden type marker; null on the daily puzzle, which omits it. */
    type: string | null;
    playable: boolean;
    reason?: string;
}

// A puzzle can be any of the 16 types, so check before playing. Judged on the rendered page
// rather than a type allowlist: any type using a single text answer box works, and a multi-box
// one (ladder) is correctly refused.
export async function inspectPuzzle(page: Page): Promise<PuzzleInspection> {
    const marker = page.locator('[data-testid^="puzzle-type-"]');
    // count() returns immediately. getAttribute() auto-waits, so on the daily puzzle — where
    // this marker is never rendered — it would block until the whole test times out.
    const type =
        (await marker.count()) > 0
            ? (await marker.first().getAttribute('data-testid'))?.replace('puzzle-type-', '') ||
              null
            : null;

    const boxes = await page.getByTestId('answer-input').count();
    if (boxes === 1) return { type, playable: true };

    return {
        type,
        playable: false,
        reason:
            boxes === 0
                ? 'no text answer box — needs click/drag or vision input'
                : `renders ${boxes} answer boxes — needs per-field logic`,
    };
}

/** Submits one guess. Returns false if the input rejected it, so nothing was actually submitted. */
async function submitGuess(
    puzzle: PuzzlePage,
    result: ResultPage,
    answer: string
): Promise<boolean> {
    await puzzle.answerInput.fill(answer);

    // Submit stays disabled if the input rejected the reply (e.g. a numeric-only field given
    // prose), which would otherwise hang the click until the test timeout.
    const enabled = await expect(puzzle.submitBtn)
        .toBeEnabled({ timeout: 2_000 })
        .then(
            () => true,
            () => false
        );
    if (!enabled) return false;

    await puzzle.submitBtn.click();
    await Promise.race([
        result.panel.waitFor({ state: 'visible', timeout: 15_000 }),
        puzzle.feedback.waitFor({ state: 'visible', timeout: 15_000 }),
    ]).catch(() => {});
    return true;
}

// Plays the puzzle already loaded on `page` the way a person would: guess, and on a wrong answer
// guess again, taking the hint before the last go. Wrong guesses cost 5 points each and a hint 10,
// so the recorded score reflects how much help the model needed.
export async function playPuzzle(page: Page, model: ModelConfig): Promise<PlayOutcome> {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);
    await expect(puzzle.shell).toBeVisible();

    // One attempt row per user per puzzle holds the cumulative state, and it's closed once the
    // puzzle is solved or given up — that's when the result panel replaces the answer box. A
    // half-finished attempt is still playable, so this only trips on a genuinely finished one.
    if (await result.panel.isVisible()) {
        const panelText = await result.panel.innerText();
        return {
            alreadyPlayed: true,
            // The result panel only congratulates an actual solve; a give-up just reveals it.
            solved: panelText.includes('Congratulations'),
            guesses: 0,
            rejected: 0,
            hintUsed: false,
            gaveUp: false,
            modelAnswer: '',
            score: await result.score.innerText().catch(() => null),
        };
    }

    const triedAnswers: string[] = [];
    let submitted = 0;
    let rejected = 0;
    let hintUsed = false;
    let modelAnswer = '';
    let solved = false;

    for (let guess = 1; guess <= MAX_GUESSES && !solved; guess++) {
        // Last go: take the hint first so the model can use it. It renders inside the puzzle
        // shell, so readPuzzleText picks it up and it reaches the model with the puzzle text.
        if (guess === MAX_GUESSES && (await puzzle.hintBtn.isVisible().catch(() => false))) {
            const before = await readPuzzleText(puzzle);
            await puzzle.revealHint();
            hintUsed = true;
            await expect.poll(() => readPuzzleText(puzzle), { timeout: 5_000 }).not.toBe(before);
        }

        const puzzleText = await readPuzzleText(puzzle);
        modelAnswer = cleanAnswer(await askModel(model, buildPrompt(puzzleText, triedAnswers)));

        // A reply the field won't take (empty, or prose in a numeric-only box) never reaches the
        // server, so it costs no points — but it still burns a round, otherwise a model that
        // keeps replying in the wrong format would loop forever.
        if (!modelAnswer || !(await submitGuess(puzzle, result, modelAnswer))) {
            rejected++;
            triedAnswers.push(modelAnswer || '(no answer)');
            continue;
        }

        submitted++;
        solved = await result.panel.isVisible();
        if (!solved) triedAnswers.push(modelAnswer);
    }

    // Out of guesses: give up so the attempt is closed and the bot's failure shows in the
    // league, rather than leaving it half-played and blocking a later retry.
    let gaveUp = false;
    if (!solved && (await puzzle.giveUpBtn.isVisible().catch(() => false))) {
        await puzzle.giveUp();
        await result.panel.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
        gaveUp = await result.panel.isVisible();
    }

    return {
        alreadyPlayed: false,
        solved,
        guesses: submitted,
        rejected,
        hintUsed,
        gaveUp,
        modelAnswer,
        score: await result.score.innerText().catch(() => null),
    };
}
