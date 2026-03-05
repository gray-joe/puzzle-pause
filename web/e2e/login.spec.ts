import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { NavPage } from "./pages/NavPage";
import { getLoginCode } from "./helpers/db";

test("New user can log in", async ({ page }) => {
  const login = new LoginPage(page);
  const nav = new NavPage(page);

  await login.goto();
  await login.expectEmailStep();

  await login.sendCode("newuser@example.com");
  await login.expectCodeStep("newuser@example.com");

  const code = getLoginCode("newuser@example.com");
  await login.enterCode(code);

  await page.waitForURL("/puzzle");
  await expect(nav.title).toBeVisible();
  await nav.expectNavLink("leagues");
  await nav.expectNavLink("account");
});

test("Existing user can log in", async ({ page }) => {
  const login = new LoginPage(page);
  const nav = new NavPage(page);

  await login.goto();
  await login.expectEmailStep();

  await login.sendCode("test@example.com");
  await login.expectCodeStep("test@example.com");

  const code = getLoginCode("test@example.com");
  await login.enterCode(code);

  await page.waitForURL("/puzzle");
  await expect(nav.title).toBeVisible();
  await nav.expectNavLink("leagues");
  await nav.expectNavLink("account");
});

test("Invalid emails do not attempt to send a code", async ({ page }) => {
  const login = new LoginPage(page);

  await login.goto();
  await login.expectEmailStep();

  await login.emailInput.fill("notanemail");
  await login.sendCodeBtn.click();

  await login.expectEmailStep();
  await expect(login.verifyMeta).not.toBeVisible();
  await expect(login.error).not.toBeVisible();
});
