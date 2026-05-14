import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('choice puzzle renders prompt and labelled options', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'choice-user@example.com');
    await page.goto('/archive/17');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Which planet is the largest');

    const options = page.locator('.choice-option');
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toContainText('A');
    await expect(options.nth(0)).toContainText('Earth');
    await expect(options.nth(1)).toContainText('B');
    await expect(options.nth(1)).toContainText('Saturn');
    await expect(options.nth(2)).toContainText('C');
    await expect(options.nth(2)).toContainText('Jupiter');
    await expect(options.nth(3)).toContainText('D');
    await expect(options.nth(3)).toContainText('Mars');

    await expect(puzzle.submitBtn).not.toBeVisible();
});

test('clicking a wrong option submits immediately and shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'choice-user@example.com');
    await page.goto('/archive/17');

    await page.getByRole('button', { name: /Saturn/ }).click();

    await puzzle.expectFeedback('Wrong');
});

test('options remain enabled after a wrong answer', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'choice-user@example.com');
    await page.goto('/archive/17');

    await page.getByRole('button', { name: /Saturn/ }).click();
    await puzzle.expectFeedback('Wrong');

    await expect(page.getByRole('button', { name: /Jupiter/ })).toBeEnabled();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'choice-user@example.com');
    await page.goto('/archive/17');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('most moons');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('clicking the correct option solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'choice-user@example.com');
    await page.goto('/archive/17');

    await page.getByRole('button', { name: /Jupiter/ }).click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await expect(page.locator('.choice-option')).not.toBeVisible();
});
