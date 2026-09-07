import { test, expect, type Page } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

async function selectMove(page: Page, from: string, to: string) {
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
}

test('chess puzzle shows turn banner and board', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'chess-user@example.com');
    await page.goto('/archive/27');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('White to move, mate in 1');
    await expect(page.getByTestId('chess-board')).toBeVisible();
    await expect(page.getByTestId('selected-move')).toContainText('Select a piece');
    await expect(puzzle.submitBtn).toBeDisabled();

    await selectMove(page, 'h5', 'f7');
    await expect(page.getByTestId('selected-move')).toContainText('h5f7');
    await expect(puzzle.feedback).not.toBeVisible();
    await page.getByTestId('reset-move-btn').click();
    await expect(page.getByTestId('selected-move')).toContainText('Select a piece');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('wrong chess move shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'chess-user@example.com');
    await page.goto('/archive/27');

    await selectMove(page, 'g1', 'f3');
    await expect(puzzle.submitBtn).toBeEnabled();
    await puzzle.submitBtn.click();
    await puzzle.expectFeedback('Wrong');
});

test('chess hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'chess-hint-user@example.com');
    await page.goto('/archive/27');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();
    await expect(puzzle.hint).toContainText('f7');
});

test('correct mating move solves the puzzle', async ({ page }) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    await loginAs(page, 'chess-user@example.com');
    await page.goto('/archive/27');

    await selectMove(page, 'h5', 'f7');
    await expect(page.getByTestId('selected-move')).toContainText('h5f7');
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
