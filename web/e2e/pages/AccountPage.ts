import { type Page, type Locator, expect } from "@playwright/test";

export class AccountPage {
  readonly page: Page;
  readonly statsTable: Locator;
  readonly statToday: Locator;
  readonly statWeekly: Locator;
  readonly statAlltime: Locator;
  readonly statAverage: Locator;
  readonly statSolved: Locator;
  readonly statStreak: Locator;
  readonly statPercentile: Locator;
  readonly displayNameInput: Locator;
  readonly saveNameBtn: Locator;
  readonly saveSuccess: Locator;
  readonly saveError: Locator;
  readonly accountEmail: Locator;
  readonly logoutBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statsTable = page.getByTestId("stats-table");
    this.statToday = page.getByTestId("stat-today");
    this.statWeekly = page.getByTestId("stat-weekly");
    this.statAlltime = page.getByTestId("stat-alltime");
    this.statAverage = page.getByTestId("stat-average");
    this.statSolved = page.getByTestId("stat-solved");
    this.statStreak = page.getByTestId("stat-streak");
    this.statPercentile = page.getByTestId("stat-percentile");
    this.displayNameInput = page.getByTestId("display-name-input");
    this.saveNameBtn = page.getByTestId("save-name-btn");
    this.saveSuccess = page.getByTestId("save-success");
    this.saveError = page.getByTestId("save-error");
    this.accountEmail = page.getByTestId("account-email");
    this.logoutBtn = page.getByTestId("logout-btn");
  }

  async goto() {
    await this.page.goto("/account");
  }

  async expectStats() {
    await expect(this.statsTable).toBeVisible();
  }

  async expectEmail(email: string) {
    await expect(this.accountEmail).toHaveText(email);
  }

  async updateDisplayName(name: string) {
    await this.displayNameInput.clear();
    await this.displayNameInput.fill(name);
    await this.saveNameBtn.click();
  }

  async expectSaveSuccess() {
    await expect(this.saveSuccess).toBeVisible();
  }

  async logout() {
    await this.logoutBtn.click();
  }
}
