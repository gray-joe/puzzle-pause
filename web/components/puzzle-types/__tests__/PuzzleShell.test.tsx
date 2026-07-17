import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PuzzleShell from '../PuzzleShell';
import { Puzzle } from '@/lib/api';

afterEach(cleanup);

function makePuzzle(): Puzzle {
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
    };
}

describe('PuzzleShell', () => {
    it('gives up and shows a locked zero-score result', async () => {
        const onAttempt = vi.fn();
        const onGiveUp = vi.fn().mockResolvedValue({
            correct: false,
            solved: true,
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
        expect(screen.getByTestId('result-panel')).toHaveTextContent('0');
        expect(screen.queryByTestId('answer-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
        expect(onAttempt).not.toHaveBeenCalled();
    });
});
