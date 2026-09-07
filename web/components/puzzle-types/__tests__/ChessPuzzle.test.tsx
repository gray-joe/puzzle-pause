import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChessPuzzle from '../ChessPuzzle';
import { Puzzle } from '@/lib/api';

vi.mock('../ChessBoardView', () => ({
    default: ({
        fen,
        onSquareClick,
    }: {
        fen: string;
        onSquareClick?: (args: { piece: unknown; square: string }) => void;
    }) => (
        <div data-testid="chess-board">
            <span data-testid="board-fen">{fen}</span>
            <button onClick={() => onSquareClick?.({ piece: {}, square: 'h5' })}>h5</button>
            <button onClick={() => onSquareClick?.({ piece: {}, square: 'f7' })}>f7</button>
        </div>
    ),
    ChessTurnBanner: ({ fen }: { fen: string }) => (
        <div data-testid="chess-turn-banner">
            {fen.startsWith('r1bq') ? 'White' : 'Black'} to move, mate in 1
        </div>
    ),
}));

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
    return {
        id: 1,
        puzzle_date: '2026-01-01',
        puzzle_type: 'chess',
        puzzle_name: 'Chess',
        question,
        hint: null,
        has_hint: false,
        puzzle_number: 1,
    };
}

describe('ChessPuzzle', () => {
    const scholarQuestion = JSON.stringify({
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    });

    it('shows side to move banner and board', () => {
        render(
            <ChessPuzzle
                puzzle={makePuzzle(scholarQuestion)}
                solved={false}
                onSubmit={() => {}}
                loading={false}
            />
        );

        expect(screen.getByTestId('chess-turn-banner')).toHaveTextContent(
            'White to move, mate in 1'
        );
        expect(screen.getByTestId('chess-board')).toBeInTheDocument();
    });

    it('selects a move on the board and waits for submit', async () => {
        const onSubmit = vi.fn();
        render(
            <ChessPuzzle
                puzzle={makePuzzle(scholarQuestion)}
                solved={false}
                onSubmit={onSubmit}
                loading={false}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'h5' }));
        await userEvent.click(screen.getByRole('button', { name: 'f7' }));

        expect(screen.getByTestId('selected-move')).toHaveTextContent('Selected move: h5f7');
        expect(onSubmit).not.toHaveBeenCalled();

        await userEvent.click(screen.getByTestId('submit-btn'));

        expect(onSubmit).toHaveBeenCalledWith('h5f7');
        expect(screen.getByTestId('selected-move')).toHaveTextContent(
            'Select a piece, then choose its destination.'
        );
    });

    it('can reset a selected move before submitting', async () => {
        const onSubmit = vi.fn();
        render(
            <ChessPuzzle
                puzzle={makePuzzle(scholarQuestion)}
                solved={false}
                onSubmit={onSubmit}
                loading={false}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'h5' }));
        await userEvent.click(screen.getByRole('button', { name: 'f7' }));
        await userEvent.click(screen.getByTestId('reset-move-btn'));

        expect(screen.getByTestId('submit-btn')).toBeDisabled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('hides move controls when solved', () => {
        render(
            <ChessPuzzle
                puzzle={makePuzzle(scholarQuestion)}
                solved={true}
                onSubmit={() => {}}
                loading={false}
            />
        );

        expect(screen.queryByTestId('selected-move')).not.toBeInTheDocument();
        expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
    });
});
