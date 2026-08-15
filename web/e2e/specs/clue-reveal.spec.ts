import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('clue-reveal puzzle renders prompt and the first clue only', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'clue-reveal-user@example.com');
    await page.goto('/archive/25');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('Who am I?');
    await expect(page.getByTestId('clue-0')).toContainText('1564 in Stratford-upon-Avon');
    await expect(page.getByTestId('clue-1')).not.toBeVisible();
    await expect(puzzle.answerInput).toBeVisible();
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until input has content', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'clue-reveal-user@example.com');
    await page.goto('/archive/25');

    await expect(puzzle.submitBtn).toBeDisabled();

    await puzzle.answerInput.fill('Shakespeare');
    await expect(puzzle.submitBtn).toBeEnabled();

    await puzzle.answerInput.fill('');
    await expect(puzzle.submitBtn).toBeDisabled();
});

test('submitting a wrong answer shows feedback and clears the input', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'clue-reveal-user@example.com');
    await page.goto('/archive/25');

    await puzzle.submitAnswer('Chaucer');

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.answerInput).toHaveValue('');
});

test('reveal next clue button shows additional clues one at a time', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'clue-reveal-user@example.com');
    await page.goto('/archive/25');

    await expect(puzzle.hintBtn).toContainText('Reveal next clue');
    await puzzle.revealHint();

    await expect(page.getByTestId('clue-1')).toContainText('37 plays and 154 sonnets');
    await expect(page.getByTestId('clue-2')).not.toBeVisible();
    await expect(puzzle.hintBtn).toBeVisible();

    await puzzle.revealHint();

    await expect(page.getByTestId('clue-2')).toContainText('Hamlet and Romeo and Juliet');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('submitting the correct answer solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'clue-reveal-user@example.com');
    await page.goto('/archive/25');

    await page.getByTestId('answer-input').fill('Shakespeare');
    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
    await result.expectAnswer('Shakespeare');

    await expect(page.getByTestId('answer-input')).not.toBeVisible();
    await expect(page.getByTestId('submit-btn')).not.toBeVisible();
});
