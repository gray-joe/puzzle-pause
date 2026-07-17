import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/db';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';

test.describe('Authenticated puzzle solving', () => {
    test('Authenticated user can solve daily puzzle', async ({ page }) => {
        const puzzle = new PuzzlePage(page);
        const result = new ResultPage(page);

        await loginAs(page, 'admin@example.com');
        await page.goto('/puzzle');

        await expect(puzzle.shell).toBeVisible();
        await puzzle.submitAnswer('2');

        await result.expectVisible();
        await result.expectAnswer('2');
        await expect(result.score).toBeVisible();
    });

    test('Hint is revealed and displayed', async ({ page }) => {
        const puzzle = new PuzzlePage(page);

        await loginAs(page, 'nonadmin@example.com');
        await page.goto('/puzzle');

        await expect(puzzle.hintBtn).toBeVisible();
        await puzzle.revealHint();

        await expect(puzzle.hint).toBeVisible();
        await expect(puzzle.hint).toContainText('Count on your fingers');
        await expect(puzzle.hintBtn).not.toBeVisible();
    });

    test('Hint button shows penalty text', async ({ page }) => {
        const puzzle = new PuzzlePage(page);

        await loginAs(page, 'edit-name@example.com');
        await page.goto('/puzzle');

        await expect(puzzle.hintBtn).toBeVisible();
        await expect(puzzle.hintBtn).toContainText('(-10 pts)');
    });

    test('Giving up records zero and prevents resubmission', async ({ page }) => {
        const puzzle = new PuzzlePage(page);
        const result = new ResultPage(page);
        const email = `give-up-${Date.now()}@example.com`;

        await loginAs(page, email);

        const todayResponse = await page.request.get('/api/puzzle/today');
        expect(todayResponse.ok()).toBeTruthy();
        const today = await todayResponse.json();

        await page.goto('/puzzle');
        await expect(puzzle.giveUpBtn).toBeVisible();
        await puzzle.giveUp();

        await result.expectVisible();
        await result.expectRevealedAnswer('2');
        await result.expectScoreValue('Gave up');
        await expect(puzzle.answerInput).not.toBeVisible();
        await expect(puzzle.submitBtn).not.toBeVisible();

        const resubmit = await page.request.post('/api/puzzle/attempt', {
            data: { puzzle_id: today.id, guess: '2' },
        });
        expect(resubmit.ok()).toBeTruthy();
        const resubmitBody = await resubmit.json();
        expect(resubmitBody.correct).toBe(false);
        expect(resubmitBody.gave_up).toBe(true);
        expect(resubmitBody.score).toBe(0);

        await page.goto('/puzzle');
        await result.expectVisible();
        await result.expectScoreValue('Gave up');
        await expect(puzzle.answerInput).not.toBeVisible();
        await expect(puzzle.submitBtn).not.toBeVisible();
    });
});
