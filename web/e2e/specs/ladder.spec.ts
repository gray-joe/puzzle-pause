import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('ladder puzzle renders steps and blank inputs', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Dawn');
    await expect(puzzle.question).toContainText('Dare');
    await expect(puzzle.question).toContainText('Dusk');

    await expect(page.getByTestId('answer-input')).toHaveCount(4);
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('typing in a blank updates the preview', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    await page.getByTestId('answer-input').nth(0).fill('darn');

    await expect(puzzle.question).toContainText('darn');
});

test('submit stays disabled until all blanks are filled', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    const inputs = page.getByTestId('answer-input');

    await inputs.nth(0).fill('darn');
    await expect(puzzle.submitBtn).toBeDisabled();
    await inputs.nth(1).fill('dark');
    await expect(puzzle.submitBtn).toBeDisabled();
    await inputs.nth(2).fill('dirk');
    await expect(puzzle.submitBtn).toBeDisabled();
    await inputs.nth(3).fill('disk');
    await expect(puzzle.submitBtn).toBeEnabled();
});

test('wrong answer shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    const inputs = page.getByTestId('answer-input');
    await inputs.nth(0).fill('xxxx');
    await inputs.nth(1).fill('yyyy');
    await inputs.nth(2).fill('zzzz');
    await inputs.nth(3).fill('wwww');
    await puzzle.submitBtn.click();

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('Dagger');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'ladder-user@example.com');
    await page.goto('/archive/5');

    const inputs = page.getByTestId('answer-input');
    await inputs.nth(0).fill('darn');
    await inputs.nth(1).fill('dark');
    await inputs.nth(2).fill('dirk');
    await inputs.nth(3).fill('disk');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).toHaveText('0');
    await expect(page.getByTestId('answer-input')).not.toBeVisible();
});
