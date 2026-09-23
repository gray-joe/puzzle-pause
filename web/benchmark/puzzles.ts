export interface PuzzleCase {
    type: string;
    archiveId: number;
}

// Archive IDs match the seeded fixtures used by web/e2e (see docs/e2e-coverage.md).
// Only puzzle types that are fully text-readable and have a single plain-text answer-input.
// Excluded despite having the `answer-input` testid:
// - `ladder`: renders one answer-input per blank, which the single-field flow can't drive.
// - `image-word`: the puzzle is an image, so a text-only prompt has nothing to work with.
export const TEXT_PUZZLES: PuzzleCase[] = [
    { type: 'word', archiveId: 2 },
    { type: 'numgrid', archiveId: 6 },
    { type: 'scrabble', archiveId: 11 },
    { type: 'math', archiveId: 12 },
    { type: 'wordsearch', archiveId: 18 },
    { type: 'clue-reveal', archiveId: 25 },
];
