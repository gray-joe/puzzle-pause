import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('image-tap puzzle renders with prompt and image', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-tap-user@example.com');
    await page.goto('/archive/22');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Click somewhere on the image');

    await expect(page.locator('img[alt="puzzle image"]')).toBeVisible();
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until the image is tapped', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-tap-user@example.com');
    await page.goto('/archive/22');

    await expect(puzzle.submitBtn).toBeDisabled();
});

test('tapping the image shows a position indicator and enables submit', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-tap-user@example.com');
    await page.goto('/archive/22');

    await page.locator('img[alt="puzzle image"]').click();

    await expect(page.locator('body')).toContainText('Tapped:');
    await expect(puzzle.submitBtn).toBeEnabled();
});

test('submitting a tap shows wrong feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-tap-user@example.com');
    await page.goto('/archive/22');

    await page.locator('img[alt="puzzle image"]').click();
    await puzzle.submitBtn.click();

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'image-tap-user@example.com');
    await page.goto('/archive/22');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('bottom-right');
    await expect(puzzle.hintBtn).not.toBeVisible();
});
