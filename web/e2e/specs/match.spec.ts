import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

test.describe.configure({ mode: "serial" });

function rightBtn(page: any, name: string) {
  return page.getByRole("button", { name, exact: true });
}

test("match puzzle renders with prompt, items, and disabled submit", async ({
  page,
}) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.question).toContainText(
    "Match each country to its capital city",
  );

  for (const item of ["France", "Japan", "Brazil", "Australia"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(item) }),
    ).toBeVisible();
  }
  for (const item of ["Canberra", "Paris", "Brasília", "Tokyo"]) {
    await expect(rightBtn(page, item)).toBeVisible();
  }

  await expect(puzzle.submitBtn).toBeDisabled();
});

test("right buttons are disabled until a left item is selected", async ({
  page,
}) => {
  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  await expect(rightBtn(page, "Paris")).toBeDisabled();

  await page.getByRole("button", { name: /France/ }).click();
  await expect(rightBtn(page, "Paris")).toBeEnabled();
});

test("selecting a pair shows the match on the left button", async ({
  page,
}) => {
  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  await page.getByRole("button", { name: /France/ }).click();
  await rightBtn(page, "Paris").click();

  await expect(page.getByRole("button", { name: /France/ })).toContainText(
    "→ Paris",
  );
});

test("reassigning a right item removes the old pairing", async ({ page }) => {
  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  await page.getByRole("button", { name: /France/ }).click();
  await rightBtn(page, "Paris").click();

  await page.getByRole("button", { name: /Japan/ }).click();
  await rightBtn(page, "Paris").click();

  await expect(page.getByRole("button", { name: /France/ })).not.toContainText(
    "→ Paris",
  );
  await expect(page.getByRole("button", { name: /Japan/ })).toContainText(
    "→ Paris",
  );
});

test("submit stays disabled until all items are matched", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  const pairs: [string, string][] = [
    ["France", "Paris"],
    ["Japan", "Tokyo"],
    ["Brazil", "Brasília"],
  ];

  for (const [left, right] of pairs) {
    await expect(puzzle.submitBtn).toBeDisabled();
    await page.getByRole("button", { name: new RegExp(left) }).click();
    await rightBtn(page, right).click();
  }

  await expect(puzzle.submitBtn).toBeDisabled();

  await page.getByRole("button", { name: /Australia/ }).click();
  await rightBtn(page, "Canberra").click();

  await expect(puzzle.submitBtn).toBeEnabled();
});

test("submitting a wrong mapping shows feedback", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  const pairs: [string, string][] = [
    ["France", "Tokyo"],
    ["Japan", "Paris"],
    ["Brazil", "Canberra"],
    ["Australia", "Brasília"],
  ];
  for (const [left, right] of pairs) {
    await page.getByRole("button", { name: new RegExp(left) }).click();
    await rightBtn(page, right).click();
  }

  await puzzle.submitBtn.click();
  await puzzle.expectFeedback("Wrong");
  await expect(puzzle.submitBtn).toBeVisible();
});

test("submitting the correct mapping solves the puzzle", async ({ page }) => {
  const result = new ResultPage(page);

  await loginAs(page, "bob@example.com");
  await page.goto("/archive/7");

  const pairs: [string, string][] = [
    ["France", "Paris"],
    ["Japan", "Tokyo"],
    ["Brazil", "Brasília"],
    ["Australia", "Canberra"],
  ];
  for (const [left, right] of pairs) {
    await page.getByRole("button", { name: new RegExp(left) }).click();
    await rightBtn(page, right).click();
  }

  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await expect(page.getByTestId("submit-btn")).not.toBeVisible();
});
