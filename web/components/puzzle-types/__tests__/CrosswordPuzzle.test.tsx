import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CrosswordPuzzle from '../CrosswordPuzzle';
import { Puzzle } from '@/lib/api';

afterEach(cleanup);

const puzzle: Puzzle = {
    id: 1,
    puzzle_date: '2026-01-01',
    puzzle_type: 'crossword',
    puzzle_name: 'Test',
    question: JSON.stringify({
        prompt: 'Mini',
        layout: ['...', '.#.', '...'],
        clues: { across: { 1: 'a', 3: 'b' }, down: { 1: 'c', 2: 'd' } },
    }),
    hint: null,
    has_hint: false,
    puzzle_number: 1,
};

describe('CrosswordPuzzle mobile input (onChange fallback)', () => {
    it.each([
        ['caret after the existing letter', 'AB'],
        ['caret before the existing letter', 'BA'],
    ])('replaces the letter with %s', (_, value) => {
        render(
            <CrosswordPuzzle
                puzzle={puzzle}
                solved={false}
                onSubmit={async () => undefined}
                loading={false}
            />
        );
        const cell = screen.getByTestId('crossword-cell-0');

        fireEvent.change(cell, { target: { value: 'A' } });
        fireEvent.change(cell, { target: { value } });

        expect(cell).toHaveValue('B');
    });
});

describe('CrosswordPuzzle direction toggle', () => {
    it('keeps direction on first click and toggles on a second click of the same cell', async () => {
        const user = userEvent.setup();
        render(
            <CrosswordPuzzle
                puzzle={puzzle}
                solved={false}
                onSubmit={async () => undefined}
                loading={false}
            />
        );
        const cell = screen.getByTestId('crossword-cell-0');
        const clue = screen.getByTestId.bind(screen, 'crossword-active-clue');

        await user.click(cell);
        expect(clue()).toHaveTextContent('1 across');
        await user.click(cell);
        expect(clue()).toHaveTextContent('1 down');
    });
});
