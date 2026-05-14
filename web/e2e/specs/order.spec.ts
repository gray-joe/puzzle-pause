import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('order puzzle renders with items and up/down arrow buttons', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'order-user@example.com');
    await page.goto('/archive/21');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('alphabetical order');

    for (const item of ['Three', 'One', 'Two']) {
        await expect(page.locator('.drag-item').filter({ hasText: item })).toBeVisible();
    }

    await expect(puzzle.submitBtn).toBeVisible();
});

test('first item Move up is disabled, last item Move down is disabled', async ({ page }) => {
    await loginAs(page, 'order-user@example.com');
    await page.goto('/archive/21');

    const firstItem = page.locator('.drag-item').first();
    const lastItem = page.locator('.drag-item').last();

    await expect(firstItem.getByRole('button', { name: 'Move up' })).toBeDisabled();
    await expect(lastItem.getByRole('button', { name: 'Move down' })).toBeDisabled();
});

test('arrow buttons reorder items', async ({ page }) => {
    await loginAs(page, 'order-user@example.com');
    await page.goto('/archive/21');

    const oneItem = page.locator('.drag-item').filter({ hasText: 'One' });
    await oneItem.getByRole('button', { name: 'Move up' }).click();

    const items = page.locator('.drag-item');
    await expect(items.first()).toContainText('One');
});

test('submitting a wrong order shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'order-user@example.com');
    await page.goto('/archive/21');

    await puzzle.submitBtn.click();

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submitting the correct order solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'order-user@example.com');
    await page.goto('/archive/21');

    const oneItem = page.locator('.drag-item').filter({ hasText: 'One' });
    await oneItem.getByRole('button', { name: 'Move up' }).click();

    const twoItem = page.locator('.drag-item').filter({ hasText: 'Two' });
    await twoItem.getByRole('button', { name: 'Move up' }).click();

    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
