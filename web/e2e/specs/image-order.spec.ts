import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('image-order puzzle renders with prompt, images, and submit button', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-order-user@example.com');
    await page.goto('/archive/23');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('correct order');

    await expect(page.locator('img[alt=""]')).toHaveCount(2);
    await expect(puzzle.submitBtn).toBeVisible();
    await expect(puzzle.submitBtn).toBeEnabled();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-order-user@example.com');
    await page.goto('/archive/23');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('first one');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the default order solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'image-order-user@example.com');
    await page.goto('/archive/23');

    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
