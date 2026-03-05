import { type Page, type Locator, expect } from "@playwright/test";

export class PuzzlePage {
  readonly page: Page;
  readonly shell: Locator;
  readonly name: Locator;
  readonly meta: Locator;
  readonly question: Locator;
  readonly answerInput: Locator;
  readonly submitBtn: Locator;
  readonly hintBtn: Locator;
  readonly hint: Locator;
  readonly feedback: Locator;

  constructor(page: Page) {
    this.page = page;
    this.shell = page.getByTestId("puzzle-shell");
    this.name = page.getByTestId("puzzle-name");
    this.meta = page.getByTestId("puzzle-meta");
    this.question = page.getByTestId("puzzle-question");
    this.answerInput = page.getByTestId("answer-input");
    this.submitBtn = page.getByTestId("submit-btn");
    this.hintBtn = page.getByTestId("hint-btn");
    this.hint = page.getByTestId("hint");
    this.feedback = page.getByTestId("puzzle-feedback");
  }

  async submitAnswer(answer: string) {
    await this.answerInput.fill(answer);
    await this.submitBtn.click();
  }

  async revealHint() {
    await this.hintBtn.click();
  }

  async expectQuestion(text: string) {
    await expect(this.question).toBeVisible();
    await expect(this.question).toContainText(text);
  }

  async expectFeedback(text: string) {
    await expect(this.feedback).toBeVisible();
    await expect(this.feedback).toContainText(text);
  }

  async expectName(name: string) {
    await expect(this.name).toBeVisible();
    await expect(this.name).toContainText(name);
  }
}
