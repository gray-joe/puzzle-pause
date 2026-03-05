import { type Page, type Locator, expect } from "@playwright/test";

export class ArchiveListPage {
  readonly page: Page;
  readonly puzzleRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.puzzleRows = page.locator(".list-row a");
  }

  async goto() {
    await this.page.goto("/archive");
  }

  async clickPuzzle(index: number) {
    await this.puzzleRows.nth(index).click();
  }

  async clickPuzzleById(id: number) {
    await this.page.goto(`/archive/${id}`);
  }

  async expectPuzzleCount(n: number) {
    await expect(this.puzzleRows).toHaveCount(n);
  }

  row(id: number) {
    return this.page.getByTestId(`archive-row-${id}`);
  }

  solvedMarker(id: number) {
    return this.page.getByTestId(`archive-solved-${id}`);
  }

  unsolvedMarker(id: number) {
    return this.page.getByTestId(`archive-unsolved-${id}`);
  }

  async expectSolved(id: number) {
    await expect(this.solvedMarker(id)).toBeVisible();
  }

  async expectUnsolved(id: number) {
    await expect(this.unsolvedMarker(id)).toBeVisible();
  }
}
