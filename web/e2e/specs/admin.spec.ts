import { test, expect } from '@playwright/test';
import {
    countCompletionEventsForPuzzle,
    createPuzzleWithCompletionEvent,
    loginAs,
} from '../helpers/db';
import { PuzzlePage } from '../pages/PuzzlePage';

const ADMIN_EMAIL = 'admin@example.com';
const PREVIEW_PUZZLE_NAME = 'Quick Maths';

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
