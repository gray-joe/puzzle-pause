import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PuzzleShell from '../PuzzleShell';
import { Puzzle } from '@/lib/api';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
    return {
        id: 1,
        puzzle_date: '2026-01-01',
        puzzle_type: 'word',
        puzzle_name: 'Test',
        question: 'What is the word?',
        hint: null,
        has_hint: false,
        total_hints: 0,
        puzzle_number: 1,
        ...overrides,
    };
}

describe('PuzzleShell', () => {
    it('gives up and shows a locked zero-score result', async () => {
        const onAttempt = vi.fn();
        const onGiveUp = vi.fn().mockResolvedValue({
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 0,
            answer: 'hello',
            question: 'What is the word?',
            explanation: null,
        });

        render(
            <PuzzleShell
                puzzle={makePuzzle()}
                onAttempt={onAttempt}
                onHint={() => Promise.resolve({ hint: '', total_hints: 0 })}
                onGiveUp={onGiveUp}
            />
        );

        await userEvent.click(screen.getByTestId('give-up-btn'));

        await waitFor(() => expect(screen.getByTestId('result-panel')).toBeInTheDocument());
        expect(screen.getByTestId('result-panel')).toHaveTextContent('Gave up');
        expect(screen.getByTestId('result-panel')).not.toHaveTextContent('Congratulations');
        expect(screen.queryByTestId('answer-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
        expect(onAttempt).not.toHaveBeenCalled();
    });

    it('shows solved-by percentage, average score, and average time taken', () => {
        render(
            <PuzzleShell
                puzzle={makePuzzle({
                    completion_stats: {
                        completed_users: 2,
                        completion_percentage: 20,
                        average_seconds: 125,
                        average_score: 72,
                    },
                })}
                onAttempt={vi.fn()}
                onHint={() => Promise.resolve({ hint: '', total_hints: 0 })}
                onGiveUp={vi.fn()}
            />
        );

        expect(screen.getByTestId('completion-stats')).toHaveTextContent(
            'Solved by: 20%Average score: 72Average time taken: 2 minutes 5 seconds'
        );
    });

    it('falls back to N/A when there is no average score', () => {
        render(
            <PuzzleShell
                puzzle={makePuzzle({
                    completion_stats: {
                        completed_users: 3,
                        completion_percentage: 25,
                        average_seconds: 61,
                        average_score: null,
                    },
                })}
                onAttempt={vi.fn()}
                onHint={() => Promise.resolve({ hint: '', total_hints: 0 })}
                onGiveUp={vi.fn()}
            />
        );

        expect(screen.getByTestId('completion-stats')).toHaveTextContent(
            'Solved by: 25%Average score: N/AAverage time taken: 1 minute 1 second'
        );
    });

    it('shows completion stats on an archived puzzle result', () => {
        render(
            <PuzzleShell
                puzzle={makePuzzle({
                    completion_stats: {
                        completed_users: 3,
                        completion_percentage: 60,
                        average_seconds: 90,
                        average_score: 85,
                    },
                })}
                initialAttempt={{
                    solved: true,
                    score: 90,
                    incorrect_guesses: 0,
                    hint_used: 0,
                    completed_at: '2026-01-01T10:01:30Z',
                    opened_at: '2026-01-01T10:00:00Z',
                }}
                isArchive
                onAttempt={vi.fn()}
                onHint={() => Promise.resolve({ hint: '', total_hints: 0 })}
                onGiveUp={vi.fn()}
            />
        );

        expect(screen.getByTestId('result-panel')).toBeInTheDocument();
        expect(screen.getByTestId('completion-stats')).toHaveTextContent(
            'Solved by: 60%Average score: 85Average time taken: 1 minute 30 seconds'
        );
    });
});
