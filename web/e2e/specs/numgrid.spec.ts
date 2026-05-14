import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('numgrid puzzle renders with a grid containing a missing cell', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'numgrid-user@example.com');
    await page.goto('/archive/6');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('missing from this grid');

    await expect(page.locator('body')).toContainText('?');

    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.answerInput).toHaveAttribute('placeholder', 'Missing number...');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'numgrid-user@example.com');
    await page.goto('/archive/6');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('11');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('input only accepts numeric characters', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'numgrid-user@example.com');
    await page.goto('/archive/6');

    await puzzle.answerInput.fill('abc');
    await expect(puzzle.answerInput).toHaveValue('');

    await puzzle.answerInput.fill('11');
    await expect(puzzle.answerInput).toHaveValue('11');
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'numgrid-user@example.com');
    await page.goto('/archive/6');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('rows');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'numgrid-user@example.com');
    await page.goto('/archive/6');

    await page.getByTestId('answer-input').fill('11');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await result.expectAnswer('11');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
