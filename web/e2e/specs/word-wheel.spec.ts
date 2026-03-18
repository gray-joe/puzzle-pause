import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

// Word-wheel puzzle is archive ID 18 (days_ago=15, "Spin to Win")
// Wheels: ["S","T",null,"R","L","I",null,"G"] and [null,"L","I","M",null,"I","N","G"]
// Answer: "starling climbing"

test.describe.configure({ mode: "serial" });

test("word wheel puzzle renders with both wheels and inputs", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await expect(page.getByTestId("puzzle-shell")).toBeVisible();
  await expect(page.getByTestId("puzzle-question")).toContainText("Find the 8-letter word");

  // Both word inputs are present
  await expect(page.getByTestId("word-input-0")).toBeVisible();
  await expect(page.getByTestId("word-input-1")).toBeVisible();

  // 4 missing letter slots (2 per wheel) are shown as "?" in the SVG
  await expect(page.locator("svg text").filter({ hasText: "?" })).toHaveCount(4);

  await expect(page.getByTestId("submit-btn")).toBeVisible();
});

test("submitting a wrong answer shows feedback", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await page.getByTestId("word-input-0").fill("STARTING");
  await page.getByTestId("word-input-1").fill("CLIMBING");
  await page.getByTestId("submit-btn").click();

  await puzzle.expectFeedback("Wrong");
  // Puzzle remains open after a wrong answer
  await expect(page.getByTestId("submit-btn")).toBeVisible();
});

test("hint can be revealed", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await expect(puzzle.hintBtn).toBeVisible();
  await puzzle.revealHint();

  await expect(puzzle.hint).toBeVisible();
  await expect(puzzle.hint).toContainText("outdoors");
  await expect(puzzle.hintBtn).not.toBeVisible();
});

test("submit button is disabled until both inputs are filled", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await expect(page.getByTestId("submit-btn")).toBeDisabled();

  await page.getByTestId("word-input-0").fill("STARLING");
  await expect(page.getByTestId("submit-btn")).toBeDisabled();

  await page.getByTestId("word-input-1").fill("CLIMBING");
  await expect(page.getByTestId("submit-btn")).toBeEnabled();

  await page.getByTestId("word-input-1").fill("");
  await expect(page.getByTestId("submit-btn")).toBeDisabled();
});

test("inputs auto-uppercase typed text", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await page.getByTestId("word-input-0").fill("starling");
  await page.getByTestId("word-input-1").fill("climbing");

  await expect(page.getByTestId("word-input-0")).toHaveValue("STARLING");
  await expect(page.getByTestId("word-input-1")).toHaveValue("CLIMBING");
});

test("pressing Enter on the last input submits the answer", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await page.getByTestId("word-input-0").fill("STARTING");
  await page.getByTestId("word-input-1").fill("CLIMBING");
  await page.getByTestId("word-input-1").press("Enter");

  await puzzle.expectFeedback("Wrong");
});

test("submitting the correct answer solves the puzzle", async ({ page }) => {
  const result = new ResultPage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/18");

  await page.getByTestId("word-input-0").fill("STARLING");
  await page.getByTestId("word-input-1").fill("CLIMBING");
  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await result.expectAnswer("starling climbing");

  // Inputs and submit button are gone after solving
  await expect(page.getByTestId("word-input-0")).not.toBeVisible();
  await expect(page.getByTestId("word-input-1")).not.toBeVisible();
  await expect(page.getByTestId("submit-btn")).not.toBeVisible();
});
