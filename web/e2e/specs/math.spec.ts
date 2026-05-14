import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('math puzzle renders question box and answer input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('If 5+2=7');
    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.answerInput).toHaveAttribute('placeholder', 'Your answer...');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('26');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('input only accepts numeric characters', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await puzzle.answerInput.fill('abc');
    await expect(puzzle.answerInput).toHaveValue('');

    await puzzle.answerInput.fill('26');
    await expect(puzzle.answerInput).toHaveValue('26');

    await puzzle.answerInput.fill('-3.5');
    await expect(puzzle.answerInput).toHaveValue('-3.5');
});

test('wrong answer shows feedback and clears input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await puzzle.submitAnswer('99');

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.answerInput).toHaveValue('');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('hint can be revealed', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('Octal');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'math-user@example.com');
    await page.goto('/archive/12');

    await page.getByTestId('answer-input').fill('26');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await result.expectAnswer('26');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
