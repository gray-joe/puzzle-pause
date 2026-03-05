import { test, expect } from "@playwright/test";
import { ArchiveListPage } from "../pages/ArchiveListPage";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";
import { loginAs } from "../helpers/db";

test("Users can only see previous puzzles in the archive", async ({ page }) => {
  const archive = new ArchiveListPage(page);

  await loginAs(page, "alice@example.com");
  await archive.goto();

  await archive.expectPuzzleCount(11);
  await expect(page.getByText("Quick Maths")).not.toBeVisible();
  await expect(page.getByText("Future Puzzle")).not.toBeVisible();
});

test("Users can see previous puzzle results in the archive", async ({
  page,
}) => {
  const archive = new ArchiveListPage(page);

  await loginAs(page, "bob@example.com");
  await archive.goto();

  // Bob has solved puzzles 1-7 (days_ago 14-10, 6, 5) + today
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    await archive.expectSolved(id);
  }
  // Puzzles 8-11 are unsolved
  for (const id of [8, 9, 10, 11]) {
    await archive.expectUnsolved(id);
  }
});

test("Users can see solve a previously unsolved puzzle, but does not recieve points", async ({
  page,
}) => {
  const puzzle = new PuzzlePage(page);
  const result = new ResultPage(page);

  await loginAs(page, "charlie@example.com");

  await page.goto("/archive/8");
  await expect(puzzle.shell).toBeVisible();
  await puzzle.expectName("Strength in Numbers");

  await puzzle.submitAnswer("10");

  await result.expectVisible();
  await expect(result.score).toHaveText("0");
  await result.expectAnswer("10");

  await result.mockClipboard();
  const shareText = await result.shareAndGetText();
  expect(shareText).toContain("I scored 0");
  expect(shareText).toContain("Puzzle Pause #8");
  expect(shareText).toContain("puzzlepause.app/archive/8");
});

test("User can reveal a hint on archive puzzle", async ({ page }) => {
  const puzzle = new PuzzlePage(page);

  // charlie has not solved puzzle 9 ("Happy Valentine's Day!"), which has hint "Use all 7 letters."
  await loginAs(page, "charlie@example.com");
  await page.goto("/archive/9");

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.hintBtn).toBeVisible();
  await puzzle.revealHint();

  await expect(puzzle.hint).toBeVisible();
  await expect(puzzle.hint).toContainText("Use all 7 letters");
  await expect(puzzle.hintBtn).not.toBeVisible();
});

test("Users can see previous puzzles result and their points for that puzzle", async ({
  page,
}) => {
  const result = new ResultPage(page);

  await loginAs(page, "bob@example.com");

  await page.goto("/archive/1");

  await result.expectVisible();
  await expect(result.score).toHaveText("100");

  await expect(result.panel).toContainText("Final score: 100 pts");
  await expect(result.panel).toContainText("Wrong guesses: 0 pts");

  // Congratulations message with answer should be visible
  await result.expectAnswer("45");

  // Archive explanation should still be visible on result view
  await expect(page.locator("body")).toContainText(
    "Archived puzzles are for practice only",
  );

  // Multi-answer puzzle should list all accepted answers
  await page.goto("/archive/4");

  await result.expectVisible();
  await expect(result.score).toHaveText("100");

  const answerEl = page.getByTestId("result-answer");
  await expect(answerEl).toContainText("State capitals");
  await expect(answerEl).toContainText("US state capitals");
  await expect(answerEl).toContainText("Capitals of US states");
  await expect(answerEl).toContainText("American state capitals");
});
