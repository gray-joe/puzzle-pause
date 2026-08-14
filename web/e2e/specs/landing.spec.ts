import { test, expect } from '@playwright/test';

test('Guest landing page shows calendar and stats login prompt', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('landing-page')).toBeVisible();
    await expect(page.getByTestId('landing-title')).toContainText('Puzzle Pause');
    await expect(page.getByTestId('landing-calendar')).toBeVisible();
    await expect(page.getByTestId('landing-selected-day')).toBeVisible();
    await expect(page.getByTestId('landing-login-prompt')).toContainText(
        'Log in to track your streak and puzzles solved.'
    );

    await expect(page.getByTestId('landing-selected-day').getByRole('link')).toHaveAttribute(
        'href',
        '/puzzle'
    );
    await expect(page.getByTestId('landing-login-link')).toHaveAttribute('href', '/login');
});
