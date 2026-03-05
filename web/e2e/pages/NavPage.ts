import { type Page, type Locator, expect } from "@playwright/test";

export class NavPage {
  readonly page: Page;
  readonly title: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId("title");
    this.loginLink = page.getByTestId("login-link");
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  navLink(label: string, active = false) {
    const suffix = active ? "-nav-link-active" : "-nav-link";
    return this.page.getByTestId(`${label}${suffix}`);
  }

  async expectNavLink(label: string, active = false) {
    await expect(this.navLink(label, active)).toBeVisible();
  }

  async expectNoNavLink(label: string) {
    await expect(this.navLink(label)).not.toBeVisible();
    await expect(this.navLink(label, true)).not.toBeVisible();
  }
}
