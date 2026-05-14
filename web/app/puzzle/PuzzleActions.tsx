'use client';

import { api, Puzzle } from '@/lib/api';
import PuzzleShell from '@/components/puzzle-types/PuzzleShell';

export default function PuzzleActions({
    puzzle,
    isLoggedIn,
}: {
    puzzle: Puzzle;
    isLoggedIn: boolean;
}) {
    return (
        <PuzzleShell
            puzzle={puzzle}
            initialAttempt={puzzle.attempt}
            isLoggedIn={isLoggedIn}
            onAttempt={(guess, openedAt, penalties) =>
                api.puzzle.attempt(puzzle.id, guess, openedAt, penalties)
            }
            onHint={() => api.puzzle.hint(puzzle.id)}
        />
    );
}
