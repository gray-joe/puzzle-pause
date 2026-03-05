import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/db";
import { AccountPage } from "./pages/AccountPage";
import { NavPage } from "./pages/NavPage";

test("User can see their account details and their stats", async ({ page }) => {
  await loginAs(page, "test@example.com");
  const account = new AccountPage(page);
  const nav = new NavPage(page);

  await account.goto();

  await nav.expectNavLink("account", true);

  await account.expectStats();
  await expect(account.statToday).toHaveText("—");
  await expect(account.statWeekly).toBeVisible();
  await expect(account.statAlltime).toHaveText("600");
  await expect(account.statAverage).toHaveText("86");
  await expect(account.statSolved).toHaveText("7");
  await expect(account.statStreak).toHaveText("0");

  await expect(account.statPercentile).toBeVisible();
  await expect(account.displayNameInput).toHaveValue("Test User");
  await account.expectEmail("test@example.com");
});

test("User can edit their name", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  const account = new AccountPage(page);

  await account.goto();

  await expect(account.displayNameInput).toHaveValue("Alice");

  await account.updateDisplayName("Alice Updated");
  await account.expectSaveSuccess();

  await account.goto();
  await expect(account.displayNameInput).toHaveValue("Alice Updated");
});

test("User can logout", async ({ page }) => {
  await loginAs(page, "charlie@example.com");
  const account = new AccountPage(page);

  await account.goto();
  await expect(account.logoutBtn).toBeVisible();

  await account.logout();

  await expect(page).toHaveURL(/\/login/);
});
