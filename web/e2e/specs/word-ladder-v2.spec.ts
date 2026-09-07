import { expect, test } from '@playwright/test';
import { loginAs } from '../helpers/db';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';

test.describe.configure({ mode: 'serial' });

test('word ladder v2 adds rows and waits for submission', async ({ page }) => {
    await loginAs(page, 'ladder-v2-user@example.com');
    await page.goto('/archive/28');

    const question = page.getByTestId('puzzle-question');
    await expect(question.getByText('COLD')).toBeVisible();
    await expect(question.getByText('WARM')).toBeVisible();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(1);

    await page.getByTestId('add-ladder-row').click();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(2);
    await expect(page.getByTestId('submit-btn')).toBeDisabled();

    await page.getByTestId('remove-ladder-row').first().click();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(1);
});

test('wrong path highlights letters matching the reference path', async ({ page }) => {
    await loginAs(page, 'ladder-v2-user@example.com');
    await page.goto('/archive/28');

    await page.getByTestId('ladder-v2-input').fill('core');
    await page.getByTestId('submit-btn').click();

    await expect(page.getByTestId('puzzle-feedback')).toContainText('Wrong');
    await expect(
        page.getByTestId('ladder-v2-letters-0').locator('[data-correct="true"]')
    ).toHaveCount(3);
});

test('dictionary-valid path solves the puzzle', async ({ page }) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    await loginAs(page, 'ladder-v2-user@example.com');
    await page.goto('/archive/28');

    await page.getByTestId('ladder-v2-input').fill('cord');
    await page.getByTestId('add-ladder-row').click();
    await page.getByTestId('ladder-v2-input').nth(1).fill('card');
    await page.getByTestId('add-ladder-row').nth(1).click();
    await page.getByTestId('ladder-v2-input').nth(2).fill('ward');
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
