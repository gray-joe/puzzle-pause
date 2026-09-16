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

        expect(screen.getByText('C')).toBeInTheDocument();
        expect(screen.getByText('O')).toBeInTheDocument();
        expect(screen.getByText('W')).toBeInTheDocument();
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

    it('flags a step in realtime when it is not a single-letter change', async () => {
        render(
            <WordLadderV2Puzzle puzzle={puzzle} solved={false} onSubmit={vi.fn()} loading={false} />
        );

        const input = screen.getByTestId('ladder-v2-input');

        await userEvent.type(input, 'cord');
        expect(screen.getByTestId('ladder-v2-letters-0')).toHaveClass(
            'ladder-grid-boxes--valid'
        );
        expect(screen.queryByTestId('ladder-v2-hint-0')).not.toBeInTheDocument();

        await userEvent.clear(input);
        await userEvent.type(input, 'warp');
        expect(screen.getByTestId('ladder-v2-letters-0')).toHaveClass(
            'ladder-grid-boxes--invalid'
        );
        expect(screen.getByTestId('ladder-v2-hint-0')).toBeInTheDocument();
    });

    it('submits all intermediate words', async () => {
        const onSubmit = vi.fn().mockResolvedValue({
            correct: false,
            score: null,
            incorrect_guesses: 1,
            solved: false,
            answer: null,
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
    });

    it('shows realtime letter hints against the final word as you type', async () => {
        render(
            <WordLadderV2Puzzle puzzle={puzzle} solved={false} onSubmit={vi.fn()} loading={false} />
        );

        // end word is "warm"; typing "wram" -> w,m match position (green), r and a are in
        // "warm" but transposed (amber)
        await userEvent.type(screen.getByTestId('ladder-v2-input'), 'wram');

        const boxes = screen
            .getByTestId('ladder-v2-letters-0')
            .querySelectorAll('.ladder-grid-box');
        expect(boxes[0]).toHaveAttribute('data-hint', 'green');
        expect(boxes[1]).toHaveAttribute('data-hint', 'amber');
        expect(boxes[2]).toHaveAttribute('data-hint', 'amber');
        expect(boxes[3]).toHaveAttribute('data-hint', 'green');
    });
});
