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

// Countdown has no answer box: the player clicks number/operator tiles to build an expression and
// the page submits its value. So the model is asked for the expression, which is then clicked in.
const COUNTDOWN_INSTRUCTIONS = [
    'This is a numbers game: reach the target by combining the given numbers with the given operators.',
    'Each number may be used at most once; you do not have to use them all. Brackets are allowed.',
    'Reply with ONLY the arithmetic expression (e.g. (75 + 3) × 2), not its result.',
];

// Word wheel's letters live in SVG segments with one text box per wheel, so the letters are read
// out in order and the model's words are split across the boxes.
const WORD_WHEEL_INSTRUCTIONS = [
    'Each wheel below lists its letters clockwise from the top; ? marks a missing letter you must fill in.',
    'Reply with ONLY one word per wheel, in wheel order, separated by spaces.',
];

// Types that need their own driver instead of the single answer box.
type PuzzleKind = 'text' | 'countdown' | 'word-wheel';

const KIND_INSTRUCTIONS: Record<PuzzleKind, string[]> = {
    text: [],
    countdown: COUNTDOWN_INSTRUCTIONS,
    'word-wheel': WORD_WHEEL_INSTRUCTIONS,
};

function buildPrompt(puzzleText: string, triedAnswers: string[], kind: PuzzleKind): string {
    return [
        'You are playing a daily puzzle game. Below is the text content of the puzzle.',
        'Reply with ONLY the final answer to submit — plain text, no markdown formatting, no explanation.',
        ...KIND_INSTRUCTIONS[kind],
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
// one (ladder) is correctly refused. Countdown and word wheel have their own drivers.
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
    if (boxes === 1 || (await puzzleKind(page)) !== 'text') return { type, playable: true };

    return {
        type,
        playable: false,
        reason:
            boxes === 0
                ? 'no text answer box — needs click/drag or vision input'
                : `renders ${boxes} answer boxes — needs per-field logic`,
    };
}

// Keyed off each type's own elements rather than the type marker, which the daily page doesn't
// render.
async function puzzleKind(page: Page): Promise<PuzzleKind> {
    if ((await page.getByTestId('target-number').count()) > 0) return 'countdown';
    if ((await page.getByTestId('word-input-0').count()) > 0) return 'word-wheel';
    return 'text';
}

const wordInputs = (page: Page) => page.locator('[data-testid^="word-input-"]');

// Each wheel's SVG sits next to its input, so read the letters from the input's parent.
async function wordWheelLetters(page: Page): Promise<string> {
    const inputs = await wordInputs(page).all();
    const wheels = await Promise.all(
        inputs.map((input) => input.locator('..').locator('svg text').allTextContents())
    );
    return wheels.map((letters, i) => `Wheel ${i + 1}: ${letters.join(' ')}`).join('\n');
}

/** Fills one word per wheel. Returns false if the reply has the wrong number of words. */
async function enterWordWheel(page: Page, answer: string): Promise<boolean> {
    const words = answer.split(/[\s,]+/).filter(Boolean);
    const inputs = await wordInputs(page).all();
    if (words.length !== inputs.length) return false;
    for (const [i, input] of inputs.entries()) await input.fill(words[i]);
    return true;
}

// The tile values, spelled out so the model doesn't have to untangle them from the flat page text.
async function countdownTiles(page: Page): Promise<string> {
    const numbers = await page.locator('[data-testid^="number-tile-"]').allInnerTexts();
    const operators = await page.locator('[data-testid^="operator-tile-"]').allInnerTexts();
    return [
        `Target: ${await page.getByTestId('target-number').innerText()}`,
        `Numbers: ${numbers.join(', ')}`,
        `Operators: ${operators.join(' ')} ( )`,
    ].join('\n');
}

// Models write * and / (or a unicode minus) as often as the tiles' own symbols.
const OP_ALIASES: Record<string, string> = {
    '*': '×',
    x: '×',
    X: '×',
    '/': '÷',
    '−': '-',
    '–': '-',
};

/** Splits "(75 + 3) * 2 = 156" into tiles to click; null if it contains anything else. */
export function tokenizeExpression(expr: string): string[] | null {
    const body = expr.replace(/=.*$/, '').trim();
    const tokens = body.match(/\d+|[-+×÷*/xX−–()]/g) ?? [];
    if (!tokens.length || tokens.join('') !== body.replace(/\s+/g, '')) return null;
    return tokens.map((t) => OP_ALIASES[t] ?? t);
}

/** Clicks the expression in. Returns false if it uses a number/operator the puzzle doesn't offer. */
async function enterCountdown(page: Page, answer: string): Promise<boolean> {
    const tokens = tokenizeExpression(answer);
    if (!tokens) return false;

    // A wrong guess leaves its expression on screen, so start from empty.
    const clearBtn = page.getByTestId('puzzle-shell').getByRole('button', { name: /^>?Clear$/ });
    if (await clearBtn.isEnabled()) await clearBtn.click();

    const numbers = await page.locator('[data-testid^="number-tile-"]').allInnerTexts();
    const operators = await page.locator('[data-testid^="operator-tile-"]').allInnerTexts();
    const used = new Set<number>();
    for (const token of tokens) {
        let testId: string;
        if (/^\d+$/.test(token)) {
            // Same value can appear on two tiles, so take the first one not yet used.
            const i = numbers.findIndex((n, idx) => n.trim() === token && !used.has(idx));
            if (i === -1) return false;
            used.add(i);
            testId = `number-tile-${i}`;
        } else if (token === '(' || token === ')') {
            testId = `bracket-tile-${token}`;
        } else {
            const i = operators.findIndex((op) => op.trim() === token);
            if (i === -1) return false;
            testId = `operator-tile-${i}`;
        }
        await page.getByTestId(testId).click();
    }
    return true;
}

/** Submits one guess. Returns false if the input rejected it, so nothing was actually submitted. */
async function submitGuess(
    puzzle: PuzzlePage,
    result: ResultPage,
    answer: string,
    kind: PuzzleKind
): Promise<boolean> {
    if (kind === 'countdown') {
        if (!(await enterCountdown(puzzle.page, answer))) return false;
    } else if (kind === 'word-wheel') {
        if (!(await enterWordWheel(puzzle.page, answer))) return false;
    } else {
        await puzzle.answerInput.fill(answer);
    }

    // Submit stays disabled if the input rejected the reply (e.g. a numeric-only field given
    // prose, or a countdown expression that doesn't evaluate), which would otherwise hang the
    // click until the test timeout.
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

    const kind = await puzzleKind(page);
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

        let puzzleText = await readPuzzleText(puzzle);
        if (kind === 'countdown') puzzleText += '\n\n' + (await countdownTiles(page));
        if (kind === 'word-wheel') puzzleText += '\n\n' + (await wordWheelLetters(page));
        modelAnswer = cleanAnswer(
            await askModel(model, buildPrompt(puzzleText, triedAnswers, kind))
        );

        // A reply the field won't take (empty, prose in a numeric-only box, a countdown number
        // that isn't on a tile, the wrong number of word-wheel words) never reaches the server, so it costs no points — but it still
        // burns a round, otherwise a model that keeps replying in the wrong format would loop
        // forever.
        if (!modelAnswer || !(await submitGuess(puzzle, result, modelAnswer, kind))) {
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
