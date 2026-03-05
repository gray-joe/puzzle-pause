import { test, expect } from "@playwright/test";
import { NavPage } from "./pages/NavPage";
import { PuzzlePage } from "./pages/PuzzlePage";
import { ResultPage } from "./pages/ResultPage";
import { ArchiveListPage } from "./pages/ArchiveListPage";

test("Puzzle page loads correctly for guest user", async ({ page }) => {
  const nav = new NavPage(page);
  const puzzle = new PuzzlePage(page);

  await nav.goto("/puzzle");

  await expect(nav.title).toBeVisible();
  await expect(nav.title).toHaveText(">Puzzle Pause");

  await nav.expectNavLink("puzzle", true);
  await nav.expectNavLink("archive");
  await nav.expectNoNavLink("leagues");
  await nav.expectNoNavLink("account");
  await nav.expectNoNavLink("admin-puzzles");

  await expect(puzzle.shell).toBeVisible();
  await puzzle.expectName("Quick Maths");

  await expect(puzzle.meta).toContainText(
    "Solve within 10 mins for up to 100 pts!",
  );
  await expect(puzzle.meta).toContainText(
    "-5 per wrong guess, -10 for a hint.",
  );

  await puzzle.expectQuestion("1+1=?");

  await expect(puzzle.feedback).not.toBeVisible();
  await expect(puzzle.answerInput).toBeVisible();
  await expect(puzzle.submitBtn).toBeVisible();
  await expect(puzzle.hintBtn).toBeVisible();

  await expect(nav.loginLink).toBeVisible();
});

test("Guests can complete daily puzzle", async ({ page }) => {
  const puzzle = new PuzzlePage(page);
  const result = new ResultPage(page);

  await page.goto("/puzzle");

  await puzzle.submitAnswer("1");
  await puzzle.expectFeedback("Wrong. 1 incorrect guess");

  await puzzle.submitAnswer("3");
  await puzzle.expectFeedback("Wrong. 2 incorrect guess");

  await puzzle.submitAnswer("2");

  await result.expectVisible();
  await expect(puzzle.question).not.toBeVisible();
  await expect(puzzle.answerInput).not.toBeVisible();

  await result.expectAnswer("2");
  await expect(result.score).not.toHaveText("0");
  await result.expectGuestCTAs();

  await result.mockClipboard();
  const shareText = await result.shareAndGetText();
  expect(shareText).toContain("I solved Quick Maths on Puzzle Pause!");
  expect(shareText).toContain("puzzlepause.app");
});

test("Guests can view and complete archived puzzles", async ({ page }) => {
  const nav = new NavPage(page);
  const puzzle = new PuzzlePage(page);
  const result = new ResultPage(page);
  const archiveList = new ArchiveListPage(page);

  await archiveList.goto();
  await nav.expectNavLink("archive", true);

  const firstPuzzle = archiveList.puzzleRows.first();
  await expect(firstPuzzle).toBeVisible();
  await archiveList.clickPuzzle(0);

  await expect(puzzle.shell).toBeVisible();
  await expect(puzzle.name).toBeVisible();
  await expect(puzzle.question).toBeVisible();

  await puzzle.submitAnswer("wrong");
  await puzzle.expectFeedback("Wrong. 1 incorrect guess");

  await archiveList.clickPuzzleById(1);
  await puzzle.expectName("Welcome to Puzzle Pause");
  await expect(puzzle.question).toBeVisible();

  await puzzle.submitAnswer("45");

  await result.expectVisible();
  await expect(puzzle.question).not.toBeVisible();

  await result.expectAnswer("45");
  await expect(result.score).toHaveText("0");
  await result.expectGuestCTAs();
});

// ToDo: Puzzle result is persisted
// test("Guests can login after completing a puzzle", async ({ page }) => {});
