import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('chess puzzle shows turn banner and board', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'chess-user@example.com');
    await page.goto('/archive/27');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('White to move, mate in 1');
    await expect(page.getByTestId('chess-board')).toBeVisible();
    await expect(puzzle.answerInput).toBeVisible();
});

test('wrong chess move shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'chess-user@example.com');
    await page.goto('/archive/27');

    await puzzle.submitAnswer('Nf3');
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

    await puzzle.submitAnswer('Qxf7#');

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
