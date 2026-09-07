import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WordLadderV2Puzzle from '../WordLadderV2Puzzle';
import { Puzzle } from '@/lib/api';

afterEach(cleanup);

const puzzle: Puzzle = {
    id: 28,
    puzzle_date: '2026-01-01',
    puzzle_type: 'word-ladder-v2',
    puzzle_name: 'Cold to Warm',
    question: 'cold, warm',
    hint: null,
    has_hint: false,
    total_hints: 0,
    puzzle_number: 28,
};

describe('WordLadderV2Puzzle', () => {
    it('starts with one editable word between fixed endpoints', () => {
        render(
            <WordLadderV2Puzzle puzzle={puzzle} solved={false} onSubmit={vi.fn()} loading={false} />
        );

        expect(screen.getByText('COLD')).toBeInTheDocument();
        expect(screen.getByText('WARM')).toBeInTheDocument();
        expect(screen.getAllByTestId('ladder-v2-input')).toHaveLength(1);
    });

    it('adds and removes intermediate words', async () => {
        render(
            <WordLadderV2Puzzle puzzle={puzzle} solved={false} onSubmit={vi.fn()} loading={false} />
        );

        await userEvent.click(screen.getByTestId('add-ladder-row'));
        expect(screen.getAllByTestId('ladder-v2-input')).toHaveLength(2);

        await userEvent.click(screen.getAllByTestId('remove-ladder-row')[0]);
        expect(screen.getAllByTestId('ladder-v2-input')).toHaveLength(1);
    });

    it('submits all intermediate words and highlights correct letters', async () => {
        const onSubmit = vi.fn().mockResolvedValue({
            correct: false,
            score: null,
            incorrect_guesses: 1,
            solved: false,
            answer: null,
            letter_feedback: [[true, true, true, false]],
        });
        render(
            <WordLadderV2Puzzle
                puzzle={puzzle}
                solved={false}
                onSubmit={onSubmit}
                loading={false}
            />
        );

        await userEvent.type(screen.getByTestId('ladder-v2-input'), 'core');
        await userEvent.click(screen.getByTestId('submit-btn'));

        expect(onSubmit).toHaveBeenCalledWith('core');
        expect(
            screen.getByTestId('ladder-v2-letters-0').querySelectorAll('[data-correct="true"]')
        ).toHaveLength(3);
    });
});
