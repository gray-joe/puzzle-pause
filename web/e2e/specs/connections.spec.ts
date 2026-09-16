import { test, expect } from '@playwright/test';
import { PuzzlePage } from '../pages/PuzzlePage';
import { ResultPage } from '../pages/ResultPage';
import { loginAs } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test('connections puzzle renders with items and category buttons', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/20');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('3 categories of 3');

    for (const item of [
        'Apple',
        'Banana',
        'Cherry',
        'Carrot',
        'Broccoli',
        'Spinach',
        'Red',
        'Blue',
        'Green',
    ]) {
        await expect(page.getByRole('button', { name: item })).toBeVisible();
    }

    await expect(page.getByRole('button', { name: /Group 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Group 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Group 3/ })).toBeVisible();

    await expect(puzzle.submitBtn).toBeVisible();
});

test('submit button is disabled until all items are assigned', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/20');

    await expect(puzzle.submitBtn).toBeDisabled();

    for (const item of [
        'Apple',
        'Banana',
        'Cherry',
        'Carrot',
        'Broccoli',
        'Spinach',
        'Red',
        'Blue',
        'Green',
    ]) {
        await page.getByRole('button', { name: item }).click();
    }

    await expect(puzzle.submitBtn).toBeEnabled();
});

test('clicking an item assigns it to the selected category', async ({ page }) => {
    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/20');

    await page.getByRole('button', { name: 'Apple' }).click();

    await expect(page.getByRole('button', { name: /Group 1 \(1\)/ })).toBeVisible();
});

test('submitting a wrong grouping shows feedback', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/20');

    await page.getByRole('button', { name: /Group 1/ }).click();
    for (const item of ['Apple', 'Banana', 'Carrot']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByRole('button', { name: /Group 2/ }).click();
    for (const item of ['Cherry', 'Broccoli', 'Spinach']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByRole('button', { name: /Group 3/ }).click();
    for (const item of ['Red', 'Blue', 'Green']) {
        await page.getByRole('button', { name: item }).click();
    }

    await puzzle.submitBtn.click();

    await puzzle.expectFeedback('Wrong');
    await expect(puzzle.submitBtn).toBeVisible();
});

test('submitting the correct grouping solves the puzzle', async ({ page }) => {
    const result = new ResultPage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/20');

    await page.getByRole('button', { name: /Group 1/ }).click();
    for (const item of ['Apple', 'Banana', 'Cherry']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByRole('button', { name: /Group 2/ }).click();
    for (const item of ['Carrot', 'Broccoli', 'Spinach']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByRole('button', { name: /Group 3/ }).click();
    for (const item of ['Red', 'Blue', 'Green']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByTestId('submit-btn').click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});

test('a puzzle with 2 categories shows exactly 2 groups and can be solved', async ({ page }) => {
    const result = new ResultPage(page);
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/29');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('2 categories of 3');

    await expect(page.getByRole('button', { name: /Group 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Group 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Group 3/ })).not.toBeVisible();

    await page.getByRole('button', { name: /Group 1/ }).click();
    for (const item of ['Salmon', 'Trout', 'Cod']) {
        await page.getByRole('button', { name: item }).click();
    }

    await page.getByRole('button', { name: /Group 2/ }).click();
    for (const item of ['Oak', 'Pine', 'Elm']) {
        await page.getByRole('button', { name: item }).click();
    }

    await expect(puzzle.submitBtn).toBeEnabled();
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});

test('previously revealed category names survive a page reload', async ({ page }) => {
    const puzzle = new PuzzlePage(page);

    // Separate login from the other tests in this file so this puzzle is
    // still unsolved (and its hint progress untouched) when this test runs.
    await loginAs(page, 'connections-hint-user@example.com');
    await page.goto('/archive/30');

    await puzzle.hintBtn.click();
    await expect(page.getByRole('button', { name: /Colors/ })).toBeVisible();

    await puzzle.hintBtn.click();
    await expect(page.getByRole('button', { name: /Shapes/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Colors/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Shapes/ })).toBeVisible();
});

test('a puzzle with 5 categories shows exactly 5 groups and can be solved', async ({ page }) => {
    const result = new ResultPage(page);
    const puzzle = new PuzzlePage(page);

    await loginAs(page, 'connections-user@example.com');
    await page.goto('/archive/30');

    await expect(puzzle.shell).toBeVisible();
    await expect(puzzle.question).toContainText('5 categories of 2');

    for (let i = 1; i <= 5; i++) {
        await expect(page.getByRole('button', { name: new RegExp(`Group ${i}\\b`) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Group 6/ })).not.toBeVisible();

    const groups = [
        ['Group 1', ['Red', 'Blue']],
        ['Group 2', ['Circle', 'Square']],
        ['Group 3', ['Cat', 'Dog']],
        ['Group 4', ['One', 'Two']],
        ['Group 5', ['North', 'South']],
    ] as const;

    for (const [groupName, items] of groups) {
        await page.getByRole('button', { name: new RegExp(groupName) }).click();
        for (const item of items) {
            await page.getByRole('button', { name: item }).click();
        }
    }

    await expect(puzzle.submitBtn).toBeEnabled();
    await puzzle.submitBtn.click();

    await result.expectVisible();
    await expect(result.score).not.toHaveText('0');
});
