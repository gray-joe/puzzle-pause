'use client';

import { useState } from 'react';
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
    const [guess, setGuess] = useState('');

    if (!data) {
        return (
            <div className="puzzle-box" data-testid="puzzle-question">
                Invalid chess puzzle data.
            </div>
        );
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!guess.trim()) return;
        onSubmit(guess.trim());
        setGuess('');
    }

    return (
        <>
            <div className="puzzle-box" data-testid="puzzle-question">
                <ChessTurnBanner fen={data.fen} />
                <ChessBoardView fen={data.fen} />
            </div>
            {!solved && (
                <form onSubmit={handleSubmit}>
                    <div className="action-btn">
                        <span className="gt">&gt;</span>
                        <input
                            type="text"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder="Enter your move (e.g. Qh5 or e2e4)..."
                            disabled={loading}
                            autoFocus
                            data-testid="answer-input"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                width: 'calc(100% - 30px)',
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        className="action-btn"
                        disabled={loading || !guess.trim()}
                        data-testid="submit-btn"
                    >
                        <span className="gt">&gt;</span>
                        {loading ? 'Checking...' : 'Submit'}
                    </button>
                </form>
            )}
        </>
    );
}
