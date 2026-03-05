import { type Page, type Locator, expect } from "@playwright/test";

export class LeagueListPage {
  readonly page: Page;
  readonly leagueList: Locator;
  readonly noLeagues: Locator;
  readonly createForm: Locator;
  readonly leagueNameInput: Locator;
  readonly joinForm: Locator;
  readonly inviteCodeInput: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.leagueList = page.getByTestId("league-list");
    this.noLeagues = page.getByTestId("no-leagues");
    this.createForm = page.getByTestId("create-league-form");
    this.leagueNameInput = page.getByTestId("league-name-input");
    this.joinForm = page.getByTestId("join-league-form");
    this.inviteCodeInput = page.getByTestId("invite-code-input");
    this.error = page.getByTestId("league-error");
  }

  async goto() {
    await this.page.goto("/leagues");
  }

  leagueRow(id: number) {
    return this.page.getByTestId(`league-row-${id}`);
  }

  async expectLeagueCount(n: number) {
    await expect(this.leagueList.locator("tbody tr")).toHaveCount(n);
  }

  async createLeague(name: string) {
    await this.leagueNameInput.fill(name);
    await this.leagueNameInput.press("Enter");
  }

  async joinLeague(code: string) {
    await this.inviteCodeInput.fill(code);
    await this.inviteCodeInput.press("Enter");
  }
}
