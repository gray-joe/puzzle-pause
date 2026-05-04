import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('word puzzle renders with HTML question and answer input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'word-user@example.com');
    await page.goto('/archive/2');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Dress, Club, Cap, Time, Light');
    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.answerInput).toHaveAttribute('placeholder', 'Your answer...');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'word-user@example.com');
    await page.goto('/archive/2');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('Night');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('submitting a wrong answer shows feedback and clears the input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'word-user@example.com');
    await page.goto('/archive/2');

    await puzzle.submitAnswer('Day');

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.answerInput).toHaveValue('');
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'word-user@example.com');
    await page.goto('/archive/2');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('getting dark');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'word-user@example.com');
    await page.goto('/archive/2');

    await page.getByTestId('answer-input').fill('Night');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).toHaveText('0');
    await result.expectAnswer('Night');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
