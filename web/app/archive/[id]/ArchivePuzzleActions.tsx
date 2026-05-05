'use client';

import { api, Puzzle } from '@/lib/api';
import PuzzleShell from '@/components/puzzle-types/PuzzleShell';

export default function ArchivePuzzleActions({
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
            isArchive
            isLoggedIn={isLoggedIn}
            onAttempt={(guess, openedAt) => api.archive.attempt(puzzle.id, guess, openedAt)}
            onHint={() => api.archive.hint(puzzle.id)}
        />
    );
}
