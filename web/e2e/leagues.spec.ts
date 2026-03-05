import { test, expect } from "@playwright/test";
import { LeagueListPage } from "./pages/LeagueListPage";
import { LeagueDetailPage } from "./pages/LeagueDetailPage";
import { loginAs } from "./helpers/db";

test("User can see a list of the leagues they are in", async ({ page }) => {
  const leagues = new LeagueListPage(page);

  await loginAs(page, "test@example.com");
  await leagues.goto();

  await expect(leagues.leagueList).toBeVisible();
  await leagues.expectLeagueCount(2);

  await expect(leagues.leagueRow(1)).toContainText("Dev League");
  await expect(leagues.leagueRow(2)).toContainText("Puzzle Pros");
});

test("User can see standings, scores and tags of a league", async ({
  page,
}) => {
  const detail = new LeagueDetailPage(page);

  await loginAs(page, "bob@example.com");
  await page.goto("/leagues/1");

  await expect(detail.name).toContainText("Dev League");
  await expect(detail.inviteCode).toHaveText("DEV001");
  await expect(detail.memberCount).toContainText("4 members");

  // Daily tab is active by default
  await detail.expectLeaderboardEntry("Bob", "95");
  await detail.expectLeaderboardEntry("Test User", "—");
  await detail.expectLeaderboardEntry("Alice", "—");

  // Switch to Weekly
  await detail.tabWeekly.click();
  const bobWeeklyRow = detail.leaderboardActive.locator("tr", {
    hasText: "Bob",
  });
  await expect(bobWeeklyRow).toBeVisible();
  await expect(bobWeeklyRow.locator("td").first()).toHaveText("1");

  // Switch to All Time
  await detail.tabAlltime.click();
  await detail.expectLeaderboardEntry("Bob", "795");
  await detail.expectLeaderboardEntry("Test User", "600");

  // Tags visible under player names in the leaderboard
  // Check tags exist in the active leaderboard area
  await expect(detail.leaderboardActive).toContainText("The One Shotter");
  await expect(detail.leaderboardActive).toContainText("The Early Riser");
});

test("User can create a league", async ({ page }) => {
  const leagues = new LeagueListPage(page);
  const detail = new LeagueDetailPage(page);

  await loginAs(page, "create-league@example.com");
  await leagues.goto();
  await leagues.createLeague("Test League");

  await expect(detail.name).toContainText("Test League");
  await expect(detail.memberCount).toContainText("1 member");
});

test("User can leave a league", async ({ page }) => {
  const detail = new LeagueDetailPage(page);

  await loginAs(page, "charlie@example.com");
  await page.goto("/leagues/1");

  await expect(detail.name).toContainText("Dev League");

  page.on("dialog", (dialog) => dialog.accept());
  await detail.leaveBtn.click();

  await page.waitForURL("/leagues");
  await expect(page.getByText("Dev League")).not.toBeVisible();
});

test("User can join a league", async ({ page }) => {
  const leagues = new LeagueListPage(page);
  const detail = new LeagueDetailPage(page);

  await loginAs(page, "join-league@example.com");
  await leagues.goto();
  await leagues.joinLeague("PRO002");

  await expect(detail.name).toContainText("Puzzle Pros");
});

test("User cannot join the same league again", async ({ page }) => {
  const leagues = new LeagueListPage(page);

  await loginAs(page, "alice@example.com");
  await leagues.goto();
  await leagues.joinLeague("DEV001");

  const detail = new LeagueDetailPage(page);
  await expect(detail.name).toContainText("Dev League");
});
