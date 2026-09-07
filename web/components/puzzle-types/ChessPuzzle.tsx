'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Puzzle } from '@/lib/api';
import { parseChessQuestion } from '@/lib/chessHelpers';
import ChessBoardView, { ChessTurnBanner } from './ChessBoardView';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (guess: string) => void;
    loading: boolean;
}

export default function ChessPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
    const data = parseChessQuestion(puzzle.question);
    const puzzleFen = data?.fen ?? '';
    const [positionFen, setPositionFen] = useState(puzzleFen);
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [selectedMove, setSelectedMove] = useState('');

    useEffect(() => {
        setPositionFen(puzzleFen);
        setSelectedSquare(null);
        setSelectedMove('');
    }, [puzzleFen]);

    const squareStyles = useMemo(() => {
        const styles: Record<string, React.CSSProperties> = {};

        if (selectedMove) {
            styles[selectedMove.slice(0, 2)] = {
                background: 'rgba(255, 215, 0, 0.45)',
            };
            styles[selectedMove.slice(2, 4)] = {
                background: 'rgba(255, 215, 0, 0.65)',
            };
            return styles;
        }

        if (!selectedSquare || !data) return styles;

        styles[selectedSquare] = {
            background: 'rgba(255, 215, 0, 0.65)',
        };

        try {
            const board = new Chess(data.fen);
            for (const move of board.moves({ square: selectedSquare, verbose: true })) {
                styles[move.to] = {
                    background:
                        'radial-gradient(circle, rgba(255, 215, 0, 0.65) 22%, transparent 24%)',
                };
            }
        } catch {
            return styles;
        }

        return styles;
    }, [data, selectedMove, selectedSquare]);

    if (!data) {
        return (
            <div className="puzzle-box" data-testid="puzzle-question">
                Invalid chess puzzle data.
            </div>
        );
    }

    function handleSquareClick({ square }: { piece: unknown; square: string }) {
        if (loading || solved || !data) return;

        const clickedSquare = square as Square;
        let board: Chess;
        try {
            board = new Chess(data.fen);
        } catch {
            return;
        }

        if (selectedMove) {
            setSelectedMove('');
            setPositionFen(data.fen);
            setSelectedSquare(null);
        }

        const clickedPiece = board.get(clickedSquare);
        if (clickedPiece?.color === board.turn()) {
            setSelectedSquare(clickedSquare);
            return;
        }

        if (!selectedSquare || selectedMove) return;

        try {
            const move = board.move({
                from: selectedSquare,
                to: clickedSquare,
                promotion: 'q',
            });
            setSelectedMove(`${move.from}${move.to}${move.promotion ?? ''}`);
            setPositionFen(board.fen());
            setSelectedSquare(null);
        } catch {
            // Keep the selected piece active so the player can choose another destination.
        }
    }

    function resetMove() {
        setPositionFen(puzzleFen);
        setSelectedSquare(null);
        setSelectedMove('');
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedMove) return;
        onSubmit(selectedMove);
        resetMove();
    }

    return (
        <>
            <div className="puzzle-box" data-testid="puzzle-question">
                <ChessTurnBanner fen={data.fen} />
                <ChessBoardView
                    fen={positionFen}
                    onSquareClick={handleSquareClick}
                    squareStyles={squareStyles}
                />
                {!solved && (
                    <div
                        className="muted"
                        data-testid="selected-move"
                        aria-live="polite"
                        style={{ marginTop: 12 }}
                    >
                        {selectedMove
                            ? `Selected move: ${selectedMove}`
                            : selectedSquare
                              ? `Selected ${selectedSquare}. Choose a destination.`
                              : 'Select a piece, then choose its destination.'}
                    </div>
                )}
            </div>
            {!solved && (
                <form onSubmit={handleSubmit}>
                    <button
                        type="submit"
                        className="action-btn"
                        disabled={loading || !selectedMove}
                        data-testid="submit-btn"
                    >
                        <span className="gt">&gt;</span>
                        {loading ? 'Checking...' : 'Submit'}
                    </button>
                    {selectedMove && (
                        <button
                            type="button"
                            className="action-btn"
                            onClick={resetMove}
                            disabled={loading}
                            data-testid="reset-move-btn"
                        >
                            <span className="gt">&gt;</span>
                            Reset move
                        </button>
                    )}
                </form>
            )}
        </>
    );
}
