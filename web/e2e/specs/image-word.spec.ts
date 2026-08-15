import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('image-word puzzle renders with prompt and image', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-word-user@example.com');
    await page.goto('/archive/26');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Which cube cannot be made from the net shown?');
    await expect(page.locator('img[alt="puzzle image"]')).toBeVisible();
    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-word-user@example.com');
    await page.goto('/archive/26');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('C');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('submitting a wrong answer shows feedback and clears the input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-word-user@example.com');
    await page.goto('/archive/26');

    await puzzle.submitAnswer('A');

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.answerInput).toHaveValue('');
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'image-word-user@example.com');
    await page.goto('/archive/26');

    await page.getByTestId('answer-input').fill('C');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await result.expectAnswer('C');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
