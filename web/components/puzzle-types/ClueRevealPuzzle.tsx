'use client';

import { useState } from 'react';
import { Puzzle } from '@/lib/api';
import { parseQuestion } from './parseQuestion';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (g: string) => void;
    loading: boolean;
    hint: string | null;
    hintsRevealed: number;
}

interface ClueRevealData {
    prompt: string;
    clues: string[];
}

export default function ClueRevealPuzzle({
    puzzle,
    solved,
    onSubmit,
    loading,
    hint,
    hintsRevealed,
}: Props) {
    const data = parseQuestion<ClueRevealData>(puzzle.question);
    const [guess, setGuess] = useState('');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!guess.trim()) return;
        onSubmit(guess.trim());
        setGuess('');
    }

    if (!data)
        return (
            <div className="error" data-testid="puzzle-question">
                Invalid puzzle data.
            </div>
        );

    const additionalClues = hint ? hint.split('|').slice(0, hintsRevealed) : [];
    const allClues = [data.clues[0], ...additionalClues];

    return (
        <>
            <div
                className="content-meta"
                data-testid="puzzle-question"
                style={{ marginBottom: 12, fontSize: '1.2rem', color: 'white' }}
            >
                {data.prompt}
            </div>
            <div style={{ marginBottom: 12 }}>
                {allClues.map((clue, i) => (
                    <div
                        key={i}
                        className="content-meta"
                        data-testid={`clue-${i}`}
                        style={{
                            marginBottom: 8,
                            padding: '8px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            color: 'white',
                            fontSize: '0.95rem',
                        }}
                    >
                        <span style={{ color: 'var(--muted)', marginRight: 8 }}>#{i + 1}</span>
                        {clue}
                    </div>
                ))}
            </div>
            {!solved && (
                <form onSubmit={handleSubmit}>
                    <div className="action-btn">
                        <span className="gt">&gt;</span>
                        <input
                            type="text"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder="Your answer..."
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
