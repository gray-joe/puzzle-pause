import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('countdown puzzle renders with prompt, target, tiles and expression area', async ({
    page,
}) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Reach the target');
    await expect(page.getByTestId('target-number')).toContainText('306');
    await expect(page.getByTestId('number-tile-0')).toBeVisible();
    await expect(page.getByTestId('operator-tile-0')).toBeVisible();
    await expect(page.getByTestId('expression-display')).toBeVisible();
});

test('submit button is disabled before any tiles are clicked', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await expect(puzzle.submitBtn).toBeDisabled();
});

test('clicking a number tile adds it to the expression and disables the tile', async ({ page }) => {
    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await page.getByTestId('number-tile-1').click(); // 50

    await expect(page.getByTestId('expression-display')).toContainText('50');
    await expect(page.getByTestId('number-tile-1')).toBeDisabled();
});

test('clicking operator tiles builds the expression', async ({ page }) => {
    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await page.getByTestId('number-tile-1').click(); // 50
    await page.getByTestId('operator-tile-2').click(); // ×
    await page.getByTestId('number-tile-2').click(); // 6

    await expect(page.getByTestId('expression-display')).toContainText('50 × 6');
    await expect(page.getByTestId('expression-result')).not.toBeVisible();
});

test('running total is hidden until Show total is clicked', async ({ page }) => {
    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await page.getByTestId('number-tile-1').click(); // 50
    await page.getByTestId('operator-tile-2').click(); // ×
    await page.getByTestId('number-tile-2').click(); // 6

    await expect(page.getByTestId('show-total-btn')).toBeVisible();
    await page.getByTestId('show-total-btn').click();

    await expect(page.getByTestId('expression-result')).toContainText('= 300');
    await expect(page.getByTestId('show-total-btn')).not.toBeVisible();
});

test('submit is disabled when expression does not match a valid result', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await page.getByTestId('operator-tile-0').click(); // just "+" — invalid
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('submitting a wrong answer shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await page.getByTestId('number-tile-0').click(); // 75
    await page.getByTestId('operator-tile-0').click(); // +
    await page.getByTestId('number-tile-1').click(); // 50

    await puzzle.submitBtn.click(); // submits 125, not 306

    await puzzle.expectFeedback('Wrong');
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('50 × 6');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'countdown-user@example.com');
    await page.goto('/archive/24');

    // 50 × 6 + 3 × 2 = 300 + 6 = 306
    await page.getByTestId('number-tile-1').click(); // 50
    await page.getByTestId('operator-tile-2').click(); // ×
    await page.getByTestId('number-tile-2').click(); // 6
    await page.getByTestId('operator-tile-0').click(); // +
    await page.getByTestId('number-tile-3').click(); // 3
    await page.getByTestId('operator-tile-2').click(); // ×
    await page.getByTestId('number-tile-4').click(); // 2

    await page.getByTestId('show-total-btn').click();
    await expect(page.getByTestId('expression-result')).toContainText('= 306');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await result.expectAnswer('306');

    await expect(page.getByTestId('expression-display')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
