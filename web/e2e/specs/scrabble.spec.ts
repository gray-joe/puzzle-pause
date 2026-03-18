import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

// Scrabble puzzle is archive ID 11 (days_ago=3, "Happy Valentine's Day!")
// Rack: ["C","O","R","M","A","N","E"], Board: 7 slots with TL on pos 2, DW on pos 5
// ROMANCE: R(1)+O(1)+M(3×TL=9)+A(1)+N(1)+C(3)+E(1)=17, ×2 DW = 34
// Answer: "romance 34"

test.describe.configure({ mode: "serial" });

test("scrabble puzzle renders with rack tiles, board slots, and modifier legend", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/11");

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.question).toContainText("highest scoring word");

  // All 7 rack letters are shown
  for (const letter of ["C", "O", "R", "M", "A", "N", "E"]) {
    await expect(page.locator("body")).toContainText(letter);
  }

  // Modifier legend is visible for TL and DW
  await expect(page.locator("body")).toContainText("Triple Letter");
  await expect(page.locator("body")).toContainText("Double Word");

  await expect(puzzle.answerInput).toBeVisible();
  await expect(puzzle.answerInput).toHaveAttribute("placeholder", "word score (e.g. mask 10)");
  await expect(puzzle.submitBtn).toBeVisible();
});

test("submitting a wrong answer shows feedback", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/11");

  await puzzle.submitAnswer("corman 8");

  await puzzle.expectFeedback("Wrong");
  // Puzzle remains open after a wrong answer
  await expect(puzzle.submitBtn).toBeVisible();
});

test("hint can be revealed", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/11");

  await expect(puzzle.hintBtn).toBeVisible();
  await puzzle.revealHint();

  await expect(puzzle.hint).toBeVisible();
  await expect(puzzle.hint).toContainText("all 7 letters");
  await expect(puzzle.hintBtn).not.toBeVisible();
});

test("submitting the correct answer with modifier bonuses solves the puzzle", async ({ page }) => {
  const result = new ResultPage(page);

  await loginAs(page, "alice@example.com");
  await page.goto("/archive/11");

  await page.getByTestId("answer-input").fill("romance 34");
  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await result.expectAnswer("romance 34");
});
