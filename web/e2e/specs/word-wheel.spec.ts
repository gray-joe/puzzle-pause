import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

// Word-wheel puzzle is archive ID 16 (days_ago=15, "Spin to Win")
// Wheels: ["S","T",null,"R","L","I",null,"G"] and [null,"L","I","M",null,"I","N","G"]
// Answer: "starling climbing"

test.describe.configure({ mode: "serial" });

test("word wheel puzzle renders with both wheels and inputs", async ({ page }) => {
  await loginAs(page, "alice@example.com");
  await page.goto("/archive/16");

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
  await page.goto("/archive/16");

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
  await page.goto("/archive/16");

  await expect(puzzle.hintBtn).toBeVisible();
  await puzzle.revealHint();

  await expect(puzzle.hint).toBeVisible();
  await expect(puzzle.hint).toContainText("outdoors");
  await expect(puzzle.hintBtn).not.toBeVisible();
});

test("submitting the correct answer solves the puzzle", async ({ page }) => {
  const result = new ResultPage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/16");

  await page.getByTestId("word-input-0").fill("STARLING");
  await page.getByTestId("word-input-1").fill("CLIMBING");
  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await result.expectAnswer("starling climbing");
});
