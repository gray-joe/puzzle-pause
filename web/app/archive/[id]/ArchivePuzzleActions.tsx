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
            key={puzzle.id}
            puzzle={puzzle}
            initialAttempt={puzzle.attempt}
            isArchive
            isLoggedIn={isLoggedIn}
            onAttempt={(guess, openedAt, penalties) =>
                api.archive.attempt(puzzle.id, guess, openedAt, penalties)
            }
            onHint={(hintsRevealed) => api.archive.hint(puzzle.id, hintsRevealed)}
            onGiveUp={() => api.archive.giveUp(puzzle.id)}
        />
    );
}
