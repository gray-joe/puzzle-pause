import { test, expect } from "@playwright/test";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

test.describe.configure({ mode: "serial" });

test("scrabble puzzle renders with rack tiles, board slots, and modifier legend", async ({
  page,
}) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "scrabble-user@example.com");
  await page.goto("/archive/11");

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.question).toContainText("highest scoring word");

  for (const letter of ["C", "O", "R", "M", "A", "N", "E"]) {
    await expect(page.locator("body")).toContainText(letter);
  }

  await expect(page.locator("body")).toContainText("Triple Letter");
  await expect(page.locator("body")).toContainText("Double Word");

  await expect(puzzle.answerInput).toBeVisible();
  await expect(puzzle.answerInput).toHaveAttribute(
    "placeholder",
    "word score (e.g. mask 10)",
  );
  await expect(puzzle.submitBtn).toBeVisible();
});

test("submitting a wrong answer shows feedback", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "scrabble-user@example.com");
  await page.goto("/archive/11");

  await puzzle.submitAnswer("corman 8");

  await puzzle.expectFeedback("Wrong");
  await expect(puzzle.submitBtn).toBeVisible();
});

test("hint can be revealed", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  await loginAs(page, "scrabble-user@example.com");
  await page.goto("/archive/11");

  await expect(puzzle.hintBtn).toBeVisible();
  await puzzle.revealHint();

  await expect(puzzle.hint).toBeVisible();
  await expect(puzzle.hint).toContainText("all 7 letters");
  await expect(puzzle.hintBtn).not.toBeVisible();
});

test("submitting the correct answer with modifier bonuses solves the puzzle", async ({
  page,
}) => {
  const result = new ResultPage(page);

  await loginAs(page, "scrabble-user@example.com");
  await page.goto("/archive/11");

  await page.getByTestId("answer-input").fill("romance 34");
  await page.getByTestId("submit-btn").click();

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await result.expectAnswer("romance 34");
});
