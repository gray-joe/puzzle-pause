import { test, expect } from '@playwright/test';
import { getLeagueById, getLeagueMemberIds, getUserByEmail, loginAs } from '../helpers/db';
import { AccountPage } from '../pages/AccountPage';
import { LeagueDetailPage } from '../pages/LeagueDetailPage';
import { NavPage } from '../pages/NavPage';

test('User can see their account details and their stats', async ({ page }) => {
    await loginAs(page, 'test@example.com');
    const account = new AccountPage(page);
    const nav = new NavPage(page);

    await account.goto();

    await nav.expectNavLink('account', true);

    await account.expectStats();
    await expect(account.statToday).toHaveText('—');
    await expect(account.statWeekly).toBeVisible();
    await expect(account.statAlltime).toHaveText('600');
    await expect(account.statAverage).toHaveText('86');
    await expect(account.statSolved).toHaveText('7');
    await expect(account.statStreak).toHaveText('0');

    await expect(account.statPercentile).toBeVisible();
    await expect(account.displayNameInput).toHaveValue('Test User');
    await account.expectEmail('test@example.com');
});

test('User can edit their name', async ({ page }) => {
    await loginAs(page, 'edit-name@example.com');
    const account = new AccountPage(page);

    await account.goto();

    await expect(account.displayNameInput).toHaveValue('EditMe');

    await account.updateDisplayName('EditMe Updated');
    await account.expectSaveSuccess();

    await account.goto();
    await expect(account.displayNameInput).toHaveValue('EditMe Updated');
});

test('User can logout', async ({ page }) => {
    await loginAs(page, 'charlie@example.com');
    const account = new AccountPage(page);

    await account.goto();
    await expect(account.logoutBtn).toBeVisible();

    await account.logout();

    await expect(page).toHaveURL(/\/login/);
});

test('User can delete their account without deleting leagues they created', async ({ page }) => {
    await loginAs(page, 'delete-account@example.com');
    const detail = new LeagueDetailPage(page);

    const before = getLeagueById(3);
    expect(before).not.toBeNull();
    const creator = getUserByEmail('delete-account@example.com')!;
    const witness = getUserByEmail('delete-witness@example.com')!;
    expect(before!.creator_id).toBe(creator.id);
    expect(getLeagueMemberIds(3)).toEqual([creator.id, witness.id].sort((a, b) => a - b));

    await page.goto('/leagues/3');
    await expect(detail.name).toContainText('Delete Test League');

    const account = new AccountPage(page);
    await account.goto();
    await account.deleteAccount();
    await expect(page).toHaveURL(/\/login/);

    const after = getLeagueById(3);
    expect(after).not.toBeNull();
    expect(after!.creator_id).toBe(witness.id);
    expect(getLeagueMemberIds(3)).toEqual([witness.id]);
    expect(getUserByEmail('delete-account@example.com')).toBeNull();
});
