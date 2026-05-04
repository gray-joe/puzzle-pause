import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('wordsearch puzzle renders grid, find line, and answer input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await expect(puzzle.shell).toBeVisible();

    await expect(page.getByTestId('puzzle-question')).toContainText('E A R T H');

    await expect(page.getByTestId('puzzle-question')).toContainText('Find: EARTH');

    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.answerInput).toHaveAttribute('placeholder', 'Found word...');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('EARTH');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('input auto-uppercases typed text', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await puzzle.answerInput.fill('earth');
    await expect(puzzle.answerInput).toHaveValue('EARTH');
});

test('submitting a wrong answer shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await puzzle.submitAnswer('WATER');
    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('third planet');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/18');

    await page.getByTestId('answer-input').fill('EARTH');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).toHaveText('0');
    await result.expectAnswer('EARTH');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
