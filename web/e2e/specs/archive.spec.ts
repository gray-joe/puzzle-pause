import { test, expect } from '@playwright/test';
import { ArchiveListPage } from '../pages/ArchiveListPage';

test.describe.configure({ mode: 'serial' });
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test('Users can only see previous puzzles in the archive', async ({ page }) => {
    const archive = new ArchiveListPage(page);

    await loginAs(page, 'alice@example.com');
    await archive.goto();

    await archive.expectPuzzleCount(24);
    await expect(page.getByText('Quick Maths')).not.toBeVisible();
    await expect(page.getByText('Future Puzzle')).not.toBeVisible();
});

test('Users can see previous puzzle results in the archive', async ({ page }) => {
    const archive = new ArchiveListPage(page);

    await loginAs(page, 'bob@example.com');
    await archive.goto();

    for (const id of [1, 2, 3, 4, 5, 8, 9]) {
        await archive.expectSolved(id);
    }
    for (const id of [6, 7, 10, 11]) {
        await archive.expectUnsolved(id);
    }
});

test('Users can solve a previously unsolved puzzle for archive points', async ({ page }) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    await loginAs(page, 'charlie@example.com');

    await page.goto('/archive/10');
    await expect(puzzle.shell).toBeVisible();
    await puzzle.expectName('Strength in Numbers');

    await puzzle.submitAnswer('10');

    await result.expectVisible();
    await expect(result.score).toHaveText('90');
    await result.expectAnswer('10');

    await result.mockClipboard();
    const shareText = await result.shareAndGetText();
    expect(shareText).toContain('I scored 90');
    expect(shareText).toContain('Puzzle Pause #21');
    expect(shareText).toContain('puzzlepause.app/archive/10');
});

test('User can reveal a hint on archive puzzle', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'charlie@example.com');
    await page.goto('/archive/11');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText('Use all 7 letters');
    await expect(puzzle.hintBtn).not.toBeVisible();
});

test('Users can see previous puzzles result and their points for that puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'bob@example.com');

    await page.goto('/archive/1');

    await result.expectVisible();
    await expect(result.score).toHaveText('100');

    await expect(result.panel).toContainText('Final score: 100 pts');
    await expect(result.panel).toContainText('Wrong guesses: 0 pts');

    await result.expectAnswer('45');

    await expect(page.locator('body')).toContainText(
        'Archived puzzles score like the daily puzzle'
    );

    await page.goto('/archive/4');

    await result.expectVisible();
    await expect(result.score).toHaveText('100');

    const answerEl = page.getByTestId('result-answer');
    await expect(answerEl).toContainText('State capitals');
    await expect(answerEl).toContainText('US state capitals');
    await expect(answerEl).toContainText('Capitals of US states');
    await expect(answerEl).toContainText('American state capitals');
});
