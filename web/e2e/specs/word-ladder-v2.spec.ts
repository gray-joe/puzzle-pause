import { expect, test } from '@playwright/test';
import { loginAs } from '../helpers/db';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';

test.describe.configure({ mode: 'serial' });

test('word ladder v2 adds rows and waits for submission', async ({ page }) => {
    await loginAs(page, 'ladder-v2-user@example.com');
    await page.goto('/archive/28');

    const question = page.getByTestId('puzzle-question');
    await expect(question.getByText('C', { exact: true })).toBeVisible();
    await expect(question.getByText('W', { exact: true })).toBeVisible();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(1);

    await page.getByTestId('add-ladder-row').click();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(2);
    await expect(page.getByTestId('submit-btn')).toBeDisabled();

    await page.getByTestId('remove-ladder-row').first().click();
    await expect(page.getByTestId('ladder-v2-input')).toHaveCount(1);
});

test('realtime hints highlight letters matching the final word as you type', async ({ page }) => {
    await loginAs(page, 'ladder-v2-user@example.com');
    await page.goto('/archive/28');

    await page.getByTestId('ladder-v2-input').fill('ward');
    await expect(
        page.getByTestId('ladder-v2-letters-0').locator('[data-hint="green"]')
    ).toHaveCount(3);

    await page.getByTestId('submit-btn').click();
    await expect(page.getByTestId('puzzle-feedback')).toContainText('Wrong');
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
    await expect(result.panel).toContainText('Congratulations! The shortest route was');
});

let scoreWithoutFinalWord: string | null = null;

test('fresh path without the final word scores the same as with it', async ({ page }) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    await loginAs(page, 'ladder-v2-no-trailing@example.com');
    await page.goto('/archive/28');

    await page.getByTestId('ladder-v2-input').fill('cord');
    await page.getByTestId('add-ladder-row').click();
    await page.getByTestId('ladder-v2-input').nth(1).fill('card');
    await page.getByTestId('add-ladder-row').nth(1).click();
    await page.getByTestId('ladder-v2-input').nth(2).fill('ward');
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    scoreWithoutFinalWord = await result.score.textContent();
});

test('redundantly repeating the final word as the last row still solves the puzzle', async ({
    page,
}) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    await loginAs(page, 'ladder-v2-trailing@example.com');
    await page.goto('/archive/28');

    await page.getByTestId('ladder-v2-input').fill('cord');
    await page.getByTestId('add-ladder-row').click();
    await page.getByTestId('ladder-v2-input').nth(1).fill('card');
    await page.getByTestId('add-ladder-row').nth(1).click();
    await page.getByTestId('ladder-v2-input').nth(2).fill('ward');
    await page.getByTestId('add-ladder-row').nth(2).click();
    await page.getByTestId('ladder-v2-input').nth(3).fill('warm');
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    expect(await result.score.textContent()).toEqual(scoreWithoutFinalWord);
});
