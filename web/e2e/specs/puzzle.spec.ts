import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/db";
import { PuzzlePage } from "../pages/PuzzlePage";
import { ResultPage } from "../pages/ResultPage";

test.describe("Authenticated puzzle solving", () => {
  test("Authenticated user can solve daily puzzle", async ({ page }) => {
    const puzzle = new PuzzlePage(page);
    const result = new ResultPage(page);

    // admin@example.com has no daily attempts in seed data
    await loginAs(page, "admin@example.com");
    await page.goto("/puzzle");

    await expect(puzzle.shell).toBeVisible();
    await puzzle.submitAnswer("2");

    await result.expectVisible();
    await result.expectAnswer("2");
    await expect(result.score).toBeVisible();
  });

  test("Hint is revealed and displayed", async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, "nonadmin@example.com");
    await page.goto("/puzzle");

    await expect(puzzle.hintBtn).toBeVisible();
    await puzzle.revealHint();

    await expect(puzzle.hint).toBeVisible();
    await expect(puzzle.hint).toContainText("Count on your fingers");
    await expect(puzzle.hintBtn).not.toBeVisible();
  });

  test("Hint button shows penalty text", async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, "edit-name@example.com");
    await page.goto("/puzzle");

    await expect(puzzle.hintBtn).toBeVisible();
    await expect(puzzle.hintBtn).toContainText("(-10 pts)");
  });
});
