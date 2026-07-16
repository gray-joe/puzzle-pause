import { test, expect, type Page } from '@playwright/test';
import {
    countCompletionEventsForPuzzle,
    createPuzzleWithCompletionEvent,
    loginAs,
} from '../helpers/db';
import { PuzzlePage } from '../pages/PuzzlePage';

const ADMIN_EMAIL = 'admin@example.com';
const PREVIEW_PUZZLE_NAME = 'Quick Maths';

async function startNewAdminPuzzle(page: Page, date: string, type: string, name: string) {
    await page.goto('/admin/puzzles/new');
    await page.locator('input[type=date]').fill(date);
    await page.locator('form select').first().selectOption(type);
    await page.locator("input[placeholder='Puzzle display name']").fill(name);
}

async function saveAndExpectPuzzle(page: Page, name: string, date: string) {
    await page.locator('button[type=submit]').click();
    await page.waitForURL('/admin/puzzles');
    await expect(page.locator('tbody tr', { hasText: name })).toContainText(date);
}

test.describe('Admin dashboard', () => {
    test.describe.configure({ mode: 'serial' });
    test('Non-admin user is redirected away from /admin', async ({ page }) => {
        await loginAs(page, 'nonadmin@example.com');
        await page.goto('/admin');
        await expect(page.locator('text=Admin — Dashboard')).not.toBeVisible();
    });

    test('Non-admin user is redirected away from /admin/puzzles', async ({ page }) => {
        await loginAs(page, 'bob@example.com');
        await page.goto('/admin/puzzles');
        await expect(page.locator('text=Admin — Puzzles')).not.toBeVisible();
    });

    test('Unauthenticated user is redirected away from /admin', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.locator('text=Admin — Dashboard')).not.toBeVisible();
    });

    test('Admin user can see the dashboard with stats', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin');

        await expect(page.locator('text=Admin — Dashboard')).toBeVisible();
        await expect(page.getByTestId('title')).toContainText('Admin');

        await expect(page.locator("td:text-is('Puzzles')")).toBeVisible();
        await expect(page.locator("td:text-is('Players')")).toBeVisible();
        await expect(page.locator("td:text-is('Attempts')")).toBeVisible();
        await expect(page.locator("td:text-is('Completion events')")).toBeVisible();
        await expect(page.locator("td:text-is('Guest completion events')")).toBeVisible();
        await expect(page.locator("td:text-is('Auth completion events')")).toBeVisible();

        const rows = page.locator('tbody tr');
        await expect(rows).toHaveCount(6);

        for (const label of ['Puzzles', 'Players', 'Attempts']) {
            const row = page.locator('tbody tr', { hasText: label });
            const text = await row.locator('td').nth(1).textContent();
            expect(Number(text)).toBeGreaterThan(0);
        }

        for (const label of [
            'Completion events',
            'Guest completion events',
            'Auth completion events',
        ]) {
            const row = page.locator('tbody tr', { hasText: label });
            const text = await row.locator('td').nth(1).textContent();
            expect(Number(text)).toBeGreaterThan(0);
        }
    });

    test('Admin nav shows Dashboard and Puzzles links on admin pages', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin');

        await expect(page.getByTestId('admin-dashboard-nav-link')).toBeVisible();
        await expect(page.getByTestId('admin-puzzles-nav-link')).toBeVisible();
        await expect(page.getByTestId('admin-completion-events-nav-link')).toBeVisible();
    });

    test('Admin nav links navigate correctly', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin');

        await page.getByTestId('admin-puzzles-nav-link').click();
        await expect(page).toHaveURL(/\/admin\/puzzles/);
        await expect(page.locator('text=Admin — Puzzles')).toBeVisible();

        await page.getByTestId('admin-dashboard-nav-link').click();
        await expect(page).toHaveURL(/\/admin$/);
        await expect(page.locator('text=Admin — Dashboard')).toBeVisible();

        await page.getByTestId('admin-completion-events-nav-link').click();
        await expect(page).toHaveURL(/\/admin\/completion-events/);
        await expect(page.locator('text=Admin — Completion Events')).toBeVisible();
    });

    test('Admin sees single admin link on non-admin pages', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/puzzle');

        await expect(page.getByTestId('admin-nav-link')).toBeVisible();
        await expect(page.getByTestId('admin-dashboard-nav-link')).not.toBeVisible();
        await expect(page.getByTestId('admin-puzzles-nav-link')).not.toBeVisible();
    });

    test('Admin pages only show admin nav links, not normal links', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin');

        await expect(page.getByTestId('admin-dashboard-nav-link')).toBeVisible();
        await expect(page.getByTestId('admin-puzzles-nav-link')).toBeVisible();

        await expect(page.getByTestId('puzzle-nav-link')).not.toBeVisible();
        await expect(page.getByTestId('puzzle-nav-link-active')).not.toBeVisible();
        await expect(page.getByTestId('archive-nav-link')).not.toBeVisible();
        await expect(page.getByTestId('account-nav-link')).not.toBeVisible();
        await expect(page.getByTestId('leagues-nav-link')).not.toBeVisible();
    });
});

test.describe('Admin completion events', () => {
    test('Admin can see seeded completion events', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/completion-events');

        await expect(page.locator('text=Admin — Completion Events')).toBeVisible();
        expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(5);
        await expect(page.locator('text=dev-guest-today')).toBeVisible();
        await expect(page.locator('text=dev-guest-simple-addition')).toBeVisible();
        await expect(page.getByRole('cell', { name: 'Bob' }).first()).toBeVisible();
    });

    test('Admin can filter seeded guest daily math completion events', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/completion-events?actor=guest&source=daily&puzzle_type=math');

        const row = page.locator('tbody tr', { hasText: 'dev-guest-simple-addition' });
        await expect(row).toBeVisible();
        await expect(row).toContainText('daily');
        await expect(row).toContainText('Simple addition?');
        await expect(row).toContainText('guest');
    });
});

test.describe('Admin puzzle preview', () => {
    test.describe.configure({ mode: 'serial' });

    test('Puzzle list has preview links', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        const previewLink = previewRow.locator('a', { hasText: 'preview' });
        await expect(previewLink).toBeVisible();
        await expect(previewLink).toHaveAttribute('href', /\/admin\/puzzles\/\d+\/preview/);
    });

    test('Preview link navigates from puzzle list', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        await previewRow.locator('a', { hasText: 'preview' }).click();

        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+\/preview/);
        await expect(page.getByTestId('title')).toContainText('Admin');
        await expect(page.getByTestId('puzzle-shell')).toBeVisible();
    });

    test('Preview page renders puzzle with question and answer', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        await previewRow.locator('a', { hasText: 'preview' }).click();

        const puzzle = new PuzzlePage(page);
        await expect(puzzle.shell).toBeVisible();
        await expect(puzzle.question).toBeVisible();

        await expect(page.locator('text=Answer:')).toBeVisible();
    });

    test('Preview page has back-to-edit link', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        const previewHref = await previewRow
            .locator('a', { hasText: 'preview' })
            .getAttribute('href');
        await page.goto(previewHref!);

        const backLink = page.locator('a', { hasText: 'Back to edit' });
        await expect(backLink).toBeVisible();

        await backLink.click();
        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+$/);
    });

    test('Edit page has preview link for existing puzzles', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        await previewRow.locator('a', { hasText: 'edit' }).click();
        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+$/);

        const previewLink = page.locator('a', { hasText: 'Preview' });
        await expect(previewLink).toBeVisible();
        await expect(previewLink).toHaveAttribute('href', /\/admin\/puzzles\/\d+\/preview/);
    });

    test('New puzzle page does not have preview link', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles/new');

        const previewLink = page.locator('a', { hasText: 'Preview' });
        await expect(previewLink).not.toBeVisible();
    });

    test('Submitting a guess in preview always shows wrong feedback', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const previewRow = page.locator('tbody tr', { hasText: PREVIEW_PUZZLE_NAME });
        await previewRow.locator('a', { hasText: 'preview' }).click();
        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+\/preview/);

        const puzzle = new PuzzlePage(page);
        await expect(puzzle.shell).toBeVisible();

        if (await puzzle.answerInput.isVisible()) {
            await puzzle.submitAnswer('1');
            await puzzle.expectFeedback('Wrong');
        }
    });

    test('Non-admin cannot access preview page', async ({ page }) => {
        await loginAs(page, 'bob@example.com');
        await page.goto('/admin/puzzles/1/preview');
        await expect(page.getByTestId('puzzle-shell')).not.toBeVisible();
    });
});

test.describe('Admin puzzle CRUD', () => {
    test.describe.configure({ mode: 'serial' });

    test('Admin can create a puzzle', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles/new');

        await page.locator('input[type=date]').fill('2099-12-31');
        await page.locator('select').selectOption('math');
        await page.locator("input[placeholder='Puzzle display name']").fill('E2E Test Puzzle');
        await page.locator('textarea').first().fill('What is 1+1?');
        await page.locator('input[type=text]').last().fill(''); // clear hint
        const answerInput = page.locator('input[type=text]').first();
        await page.locator('input[required][type=text]').fill('2');
        await page.locator('button[type=submit]').click();

        await page.waitForURL('/admin/puzzles');
        await expect(page.locator('text=E2E Test Puzzle')).toBeVisible();
        await expect(page.locator('text=2099-12-31')).toBeVisible();
    });

    test('Admin can create puzzles with specialized builders', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);

        await test.step('word editor', async () => {
            await startNewAdminPuzzle(page, '2099-10-30', 'word', 'E2E Builder Word');
            await page.locator('textarea').first().fill('What word means daily puzzle?');
            await page.locator('input[required][type=text]').fill('routine');
            await saveAndExpectPuzzle(page, 'E2E Builder Word', '2099-10-30');
        });

        await test.step('wordsearch builder', async () => {
            await startNewAdminPuzzle(page, '2099-10-31', 'wordsearch', 'E2E Builder Wordsearch');
            await expect(page.getByTestId('wordsearch-builder')).toBeVisible();
            for (const [index, letter] of ['E', 'A', 'R', 'T', 'H'].entries()) {
                await page.getByTestId(`wordsearch-cell-0-${index}`).fill(letter);
            }
            await page.getByTestId('wordsearch-word-0').fill('EARTH');
            await page.getByTestId('wordsearch-theme').fill('Planet');
            await saveAndExpectPuzzle(page, 'E2E Builder Wordsearch', '2099-10-31');
        });

        await test.step('numgrid builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-01', 'numgrid', 'E2E Builder Numgrid');
            await expect(page.getByTestId('numgrid-builder')).toBeVisible();
            await page.getByTestId('numgrid-answer').fill('11');
            await saveAndExpectPuzzle(page, 'E2E Builder Numgrid', '2099-11-01');
        });

        await test.step('word-wheel builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-02', 'word-wheel', 'E2E Builder Word Wheel');
            await expect(page.getByTestId('word-wheel-builder')).toBeVisible();
            await page.getByTestId('word-wheel-letter-0-0').fill('S');
            await page.getByTestId('word-wheel-letter-0-1').fill('T');
            await page.getByTestId('word-wheel-letter-0-3').fill('R');
            await page.getByTestId('word-wheel-letter-0-4').fill('L');
            await page.getByTestId('word-wheel-letter-0-5').fill('I');
            await page.getByTestId('word-wheel-letter-0-7').fill('G');
            await page.getByTestId('word-wheel-answer-0').fill('STARLING');
            await saveAndExpectPuzzle(page, 'E2E Builder Word Wheel', '2099-11-02');
        });

        await test.step('word ladder builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-03', 'ladder', 'E2E Builder Ladder');
            await expect(page.getByTestId('word-ladder-builder')).toBeVisible();
            await page.getByTestId('ladder-step-value-1').fill('Darn');
            await page.getByTestId('ladder-step-value-3').fill('Dark');
            await saveAndExpectPuzzle(page, 'E2E Builder Ladder', '2099-11-03');
        });

        await test.step('choice builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-04', 'choice', 'E2E Builder Choice');
            await expect(page.getByTestId('choice-builder')).toBeVisible();
            await page.getByTestId('choice-prompt').fill('Which option is correct?');
            await page.getByTestId('choice-option-0').fill('Wrong');
            await page.getByTestId('choice-option-1').fill('Right');
            await page.getByTestId('choice-correct-1').check();
            await saveAndExpectPuzzle(page, 'E2E Builder Choice', '2099-11-04');
        });

        await test.step('order builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-05', 'order', 'E2E Builder Order');
            await expect(page.getByTestId('order-builder')).toBeVisible();
            await page.getByTestId('order-prompt').fill('Sort these alphabetically:');
            await page.getByTestId('order-item-0').fill('Beta');
            await page.getByTestId('order-item-1').fill('Alpha');
            await page.getByTestId('order-correct-down-0').click();
            await saveAndExpectPuzzle(page, 'E2E Builder Order', '2099-11-05');
        });

        await test.step('match builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-06', 'match', 'E2E Builder Match');
            await expect(page.getByTestId('match-builder')).toBeVisible();
            await page.getByTestId('match-prompt').fill('Match each letter to its number:');
            await page.getByTestId('match-left-0').fill('A');
            await page.getByTestId('match-right-0').fill('One');
            await page.getByTestId('match-left-1').fill('B');
            await page.getByTestId('match-right-1').fill('Two');
            await page.getByTestId('match-right-down-0').click();
            await saveAndExpectPuzzle(page, 'E2E Builder Match', '2099-11-06');
        });

        await test.step('connections builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-07', 'connections', 'E2E Builder Connections');
            await expect(page.getByTestId('connections-builder')).toBeVisible();
            await page.getByTestId('connections-prompt').fill('Group these words:');
            await page.getByTestId('connections-category-0').fill('Animals');
            await page.getByTestId('connections-item-0-0').fill('Cat');
            await page.getByTestId('connections-item-0-1').fill('Dog');
            await page.getByTestId('connections-category-1').fill('Colors');
            await page.getByTestId('connections-item-1-0').fill('Red');
            await page.getByTestId('connections-item-1-1').fill('Blue');
            await saveAndExpectPuzzle(page, 'E2E Builder Connections', '2099-11-07');
        });

        await test.step('scrabble builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-08', 'scrabble', 'E2E Builder Scrabble');
            await expect(page.getByTestId('scrabble-builder')).toBeVisible();
            await page.getByTestId('scrabble-prompt').fill('Find the best word and score:');
            await page.getByTestId('scrabble-rack').fill('CORMANE');
            await page.getByTestId('scrabble-answer').fill('romance 34');
            await saveAndExpectPuzzle(page, 'E2E Builder Scrabble', '2099-11-08');
        });

        await test.step('countdown builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-09', 'countdown', 'E2E Builder Countdown');
            await expect(page.getByTestId('countdown-builder')).toBeVisible();
            await page.getByTestId('countdown-target').fill('306');
            await page.getByTestId('countdown-numbers').fill('75,50,6,3,2,1');
            await page.getByTestId('countdown-answer').fill('306');
            await saveAndExpectPuzzle(page, 'E2E Builder Countdown', '2099-11-09');
        });

        await test.step('clue-reveal builder', async () => {
            await startNewAdminPuzzle(page, '2099-11-10', 'clue-reveal', 'E2E Builder Clue Reveal');
            await expect(page.getByTestId('clue-reveal-builder')).toBeVisible();
            await page.getByTestId('clue-reveal-prompt').fill('Who am I?');
            await page.getByTestId('clue-reveal-clue-0').fill('I wrote Hamlet.');
            await page.getByTestId('clue-reveal-clue-1').fill('I wrote Romeo and Juliet.');
            await page.getByTestId('clue-reveal-answer').fill('Shakespeare');
            await saveAndExpectPuzzle(page, 'E2E Builder Clue Reveal', '2099-11-10');
        });
    });

    test('Admin can edit a puzzle', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const row = page.locator('tbody tr', { hasText: 'E2E Test Puzzle' });
        await row.locator('a', { hasText: 'edit' }).click();
        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+$/);

        const nameInput = page.locator("input[placeholder='Puzzle display name']");
        await nameInput.clear();
        await nameInput.fill('E2E Updated Puzzle');
        await page.locator('button[type=submit]').click();

        await page.waitForURL('/admin/puzzles');
        await expect(page.locator('text=E2E Updated Puzzle')).toBeVisible();
        await expect(page.locator('text=E2E Test Puzzle')).not.toBeVisible();
    });

    test('Admin can add an explanation to a puzzle', async ({ page }) => {
        const explanation = 'Adding the two ones gives two.';

        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const row = page.locator('tbody tr', { hasText: 'E2E Updated Puzzle' });
        await row.locator('a', { hasText: 'edit' }).click();
        await expect(page).toHaveURL(/\/admin\/puzzles\/\d+$/);

        const explanationTextarea = page.locator(
            "textarea[placeholder='Explain the logic behind the answer']"
        );
        await explanationTextarea.fill(explanation);
        await page.locator('button[type=submit]').click();

        await page.waitForURL('/admin/puzzles');
        await row.locator('a', { hasText: 'edit' }).click();
        await expect(explanationTextarea).toHaveValue(explanation);
    });

    test('Admin can delete a puzzle', async ({ page }) => {
        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const row = page.locator('tbody tr', { hasText: 'E2E Updated Puzzle' });
        await expect(row).toBeVisible();

        page.on('dialog', (dialog) => dialog.accept());
        await row.locator('button', { hasText: 'delete' }).click();

        await expect(row).not.toBeVisible();
    });

    test('Admin can delete a puzzle with completion events', async ({ page }) => {
        const { puzzleId, puzzleName } = createPuzzleWithCompletionEvent();
        expect(countCompletionEventsForPuzzle(puzzleId)).toBe(1);

        await loginAs(page, ADMIN_EMAIL);
        await page.goto('/admin/puzzles');

        const row = page.locator('tbody tr', { hasText: puzzleName });
        await expect(row).toBeVisible();

        page.on('dialog', (dialog) => dialog.accept());
        await row.locator('button', { hasText: 'delete' }).click();

        await expect(row).not.toBeVisible();
        expect(countCompletionEventsForPuzzle(puzzleId)).toBe(0);
    });
});
