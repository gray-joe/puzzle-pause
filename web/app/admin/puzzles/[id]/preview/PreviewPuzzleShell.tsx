'use client';

import { AdminPuzzle, AttemptResult } from '@/lib/api';
import PuzzleShell from '@/components/puzzle-types/PuzzleShell';

export default function PreviewPuzzleShell({ puzzle }: { puzzle: AdminPuzzle }) {
    const onAttempt = async (guess: string): Promise<AttemptResult> => ({
        correct: false,
        score: null,
        incorrect_guesses: 0,
        solved: false,
        answer: null,
    });

    const onHint = async () => ({ hint: puzzle.hint ?? 'No hint available', total_hints: 1 });

    const onGiveUp = async (): Promise<AttemptResult> => ({
        correct: false,
        score: 0,
        incorrect_guesses: 0,
        solved: true,
        answer: puzzle.answer,
        question: puzzle.question,
        explanation: puzzle.explanation,
    });

    return (
        <>
            <PuzzleShell
                puzzle={puzzle}
                isArchive={false}
                isLoggedIn={false}
                onAttempt={onAttempt}
                onHint={onHint}
                onGiveUp={onGiveUp}
            />
            <div className="content-meta muted" style={{ marginTop: 16 }}>
                Answer: {puzzle.answer}
            </div>
        </>
    );
}
