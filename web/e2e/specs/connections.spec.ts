import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

test.describe.configure({ mode: "serial" });

test("connections puzzle renders with items and category buttons", async ({
  page,
}) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "connections-user@example.com");
  await page.goto("/archive/20");

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.question).toContainText("3 categories of 3");

  for (const item of ["Apple", "Banana", "Cherry", "Carrot", "Broccoli", "Spinach", "Red", "Blue", "Green"]) {
    await expect(page.getByRole("button", { name: item })).toBeVisible();
  }

  await expect(page.getByRole("button", { name: /Group 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Group 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Group 3/ })).toBeVisible();

  await expect(puzzle.submitBtn).toBeVisible();
});

test("submit button is disabled until all items are assigned", async ({
  page,
}) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "connections-user@example.com");
  await page.goto("/archive/20");

  await expect(puzzle.submitBtn).toBeDisabled();

  for (const item of ["Apple", "Banana", "Cherry", "Carrot", "Broccoli", "Spinach", "Red", "Blue", "Green"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await expect(puzzle.submitBtn).toBeEnabled();
});

test("clicking an item assigns it to the selected category", async ({
  page,
}) => {
  await loginAs(page, "connections-user@example.com");
  await page.goto("/archive/20");

  await page.getByRole("button", { name: "Apple" }).click();

  await expect(page.getByRole("button", { name: /Group 1 \(1\)/ })).toBeVisible();
});

test("submitting a wrong grouping shows feedback", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "connections-user@example.com");
  await page.goto("/archive/20");

  await page.getByRole("button", { name: /Group 1/ }).click();
  for (const item of ["Apple", "Banana", "Carrot"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await page.getByRole("button", { name: /Group 2/ }).click();
  for (const item of ["Cherry", "Broccoli", "Spinach"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await page.getByRole("button", { name: /Group 3/ }).click();
  for (const item of ["Red", "Blue", "Green"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await puzzle.submitBtn.click();

  await puzzle.expectFeedback("Wrong");
  await expect(puzzle.submitBtn).toBeVisible();
});

test("submitting the correct grouping solves the puzzle", async ({ page }) => {
  const result = new ResultPage(page);

  await loginAs(page, "connections-user@example.com");
  await page.goto("/archive/20");

  await page.getByRole("button", { name: /Group 1/ }).click();
  for (const item of ["Apple", "Banana", "Cherry"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await page.getByRole("button", { name: /Group 2/ }).click();
  for (const item of ["Carrot", "Broccoli", "Spinach"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await page.getByRole("button", { name: /Group 3/ }).click();
  for (const item of ["Red", "Blue", "Green"]) {
    await page.getByRole("button", { name: item }).click();
  }

  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
});
