import { test, expect, type Page } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

// Seed puzzle: CAT / A#O / BOW
const ARCHIVE_URL = '/archive/31';

async function typeAt(page: Page, cell: number, text: string) {
    await page.getByTestId(`crossword-cell-${cell}`).click();
    await page.keyboard.type(text);
}

async function fillGrid(page: Page, last = 'W') {
    await typeAt(page, 0, 'CAT'); // 1 across
    await typeAt(page, 6, `BO${last}`); // 3 across
    await typeAt(page, 3, 'A'); // only in 1 down, so direction switches
    await typeAt(page, 5, 'O');
}

test('crossword renders grid and clues', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'crossword-render@example.com');
    await page.goto(ARCHIVE_URL);

    await expect(puzzle.shell).toBeVisible();
    await expect(page.getByTestId('crossword-grid')).toBeVisible();
    await expect(page.getByTestId('crossword-cell-4')).toHaveCount(0); // black square
    await expect(page.getByTestId('crossword-clues')).toContainText('Feline pet');
    await expect(page.getByTestId('crossword-clues')).toContainText('Yellow taxi');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('typing advances along the word and clicking toggles direction', async ({ page }) => {
    await loginAs(page, 'crossword-typing@example.com');
    await page.goto(ARCHIVE_URL);

    await typeAt(page, 0, 'CA');
    await expect(page.getByTestId('crossword-cell-1')).toHaveValue('A');
    await expect(page.getByTestId('crossword-active-clue')).toContainText('1 across');

    // Focus has advanced to cell 2; clicking the active cell switches direction.
    await page.getByTestId('crossword-cell-2').click();
    await expect(page.getByTestId('crossword-active-clue')).toContainText('2 down');
    await page.keyboard.type('TO');
    await expect(page.getByTestId('crossword-cell-5')).toHaveValue('O');
});

test('wrong grid counts as a wrong guess', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'crossword-wrong@example.com');
    await page.goto(ARCHIVE_URL);

    await fillGrid(page, 'L');
    await expect(puzzle.submitBtn).toBeEnabled();
    await puzzle.submitBtn.click();
    await expect(page.getByTestId('puzzle-feedback')).toContainText('Wrong');
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'crossword-hint@example.com');
    await page.goto(ARCHIVE_URL);

    await puzzle.revealHint();
    await expect(puzzle.hint).toContainText('purrs');
});

test('submitting the correct grid solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'crossword-solve@example.com');
    await page.goto(ARCHIVE_URL);

    await fillGrid(page);
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await expect(page.getByTestId('crossword-solution')).toContainText('BOW');
});
