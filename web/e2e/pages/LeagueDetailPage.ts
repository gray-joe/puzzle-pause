import { type Page, type Locator, expect } from "@playwright/test";

export class LeagueDetailPage {
  readonly page: Page;
  readonly name: Locator;
  readonly inviteCode: Locator;
  readonly memberCount: Locator;
  readonly tags: Locator;
  readonly leaderboardActive: Locator;
  readonly tabDaily: Locator;
  readonly tabWeekly: Locator;
  readonly tabAlltime: Locator;
  readonly copyLinkBtn: Locator;
  readonly leaveBtn: Locator;
  readonly deleteBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.name = page.getByTestId("league-name");
    this.inviteCode = page.getByTestId("league-invite-code");
    this.memberCount = page.getByTestId("league-member-count");
    this.tags = page.getByTestId("league-tags");
    this.leaderboardActive = page.getByTestId("leaderboard-active");
    this.tabDaily = page.getByTestId("leaderboard-tab-daily");
    this.tabWeekly = page.getByTestId("leaderboard-tab-weekly");
    this.tabAlltime = page.getByTestId("leaderboard-tab-alltime");
    this.copyLinkBtn = page.getByTestId("copy-link-btn");
    this.leaveBtn = page.getByTestId("leave-league-btn");
    this.deleteBtn = page.getByTestId("delete-league-btn");
  }

  tag(key: string) {
    return this.page.getByTestId(`tag-${key}`);
  }

  async expectTag(key: string, displayName: string) {
    const tag = this.tag(key);
    await expect(tag).toBeVisible();
    await expect(tag).toContainText(displayName);
  }

  async expectLeaderboardEntry(displayName: string, score: string) {
    const row = this.leaderboardActive.locator("tr", { hasText: displayName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(score);
  }
}
