import { type Page, type Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly meta: Locator;
  readonly emailInput: Locator;
  readonly sendCodeBtn: Locator;
  readonly verifyMeta: Locator;
  readonly codeInput: Locator;
  readonly verifyBtn: Locator;
  readonly changeEmailBtn: Locator;
  readonly error: Locator;
  readonly loginForm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.meta = page.getByTestId("login-meta");
    this.emailInput = page.getByTestId("email-input");
    this.sendCodeBtn = page.getByTestId("send-code-btn");
    this.verifyMeta = page.getByTestId("verify-meta");
    this.codeInput = page.getByTestId("code-input");
    this.verifyBtn = page.getByTestId("verify-btn");
    this.changeEmailBtn = page.getByTestId("change-email-btn");
    this.error = page.getByTestId("login-error");
    this.loginForm = page.getByTestId("login-form");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async sendCode(email: string) {
    await this.emailInput.fill(email);
    await this.sendCodeBtn.click();
  }

  async enterCode(code: string) {
    await this.codeInput.fill(code);
    await this.verifyBtn.click();
  }

  async expectEmailStep() {
    await expect(this.meta).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.sendCodeBtn).toBeVisible();
  }

  async expectCodeStep(email: string) {
    await expect(this.verifyMeta).toContainText(email);
    await expect(this.codeInput).toBeVisible();
    await expect(this.verifyBtn).toBeVisible();
  }

  async expectError(text: string) {
    await expect(this.error).toBeVisible();
    await expect(this.error).toContainText(text);
  }
}
