import { type Page, type Locator, expect } from "@playwright/test";

export class ResultPage {
  readonly page: Page;
  readonly panel: Locator;
  readonly score: Locator;
  readonly shareBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId("result-panel");
    this.score = page.getByTestId("result-score");
    this.shareBtn = page.getByTestId("share-btn");
  }

  async mockClipboard() {
    await this.page.evaluate(() => {
      (window as any).__clipboardText = "";
      navigator.clipboard.writeText = async (text: string) => {
        (window as any).__clipboardText = text;
      };
    });
  }

  async shareAndGetText(): Promise<string> {
    await this.shareBtn.click();
    return this.page.evaluate(() => (window as any).__clipboardText);
  }

  async expectVisible() {
    await expect(this.panel).toBeVisible();
    await expect(this.score).toBeVisible();
  }

  async expectAnswer(text: string) {
    await expect(this.panel).toContainText("The answer was:");
    await expect(this.panel).toContainText(text);
  }

  async expectScore() {
    await expect(this.score).toBeVisible();
  }

  async expectGuestCTAs() {
    await expect(this.panel).toContainText("Log in to save your scores");
    await expect(this.shareBtn).toBeVisible();
  }
}
