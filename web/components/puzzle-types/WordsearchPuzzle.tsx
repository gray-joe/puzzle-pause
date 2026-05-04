'use client';

import { useState } from 'react';
import { Puzzle } from '@/lib/api';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (g: string) => void;
    loading: boolean;
}

export default function WordsearchPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
    // question format: "grid_rows\nFind: N\nTheme: text" (new) or "grid_rows\nFind: WORD" (legacy)
    const lines = puzzle.question.split('\n');
    const findLine = lines.find((l) => l.startsWith('Find:') || l.startsWith('find:'));
    const themeLine = lines.find((l) => l.startsWith('Theme:') || l.startsWith('theme:'));
    const gridLines = lines.filter(
        (l) =>
            !l.startsWith('Find:') &&
            !l.startsWith('find:') &&
            !l.startsWith('Theme:') &&
            !l.startsWith('theme:') &&
            l.trim()
    );
    const findValue = findLine?.replace(/^find:\s*/i, '').trim() ?? '';
    const isCountFormat = /^\d+$/.test(findValue);
    const wordCount = isCountFormat ? parseInt(findValue, 10) : 1;
    const theme = themeLine?.replace(/^theme:\s*/i, '').trim();

    const [guesses, setGuesses] = useState<string[]>(() => Array(wordCount).fill(''));

    const allFilled = guesses.every((g) => g.trim().length > 0);

    function handleGuessChange(index: number, val: string) {
        const upper = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setGuesses((prev) => prev.map((g, i) => (i === index ? upper : g)));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!allFilled) return;
        onSubmit(guesses.map((g) => g.trim()).join(' '));
        setGuesses(Array(wordCount).fill(''));
    }

    return (
        <>
            <div
                className="puzzle-box"
                data-testid="puzzle-question"
                style={{ flexDirection: 'column' }}
            >
                {gridLines.length > 0 ? (
                    <pre
                        style={{
                            fontFamily: 'inherit',
                            margin: 0,
                            letterSpacing: '0.3em',
                            lineHeight: 1.8,
                            color: 'var(--text)',
                        }}
                    >
                        {gridLines.join('\n')}
                    </pre>
                ) : (
                    <div style={{ fontSize: '1.1em' }}>{puzzle.question}</div>
                )}
                {isCountFormat ? (
                    <div style={{ marginTop: 12, color: 'var(--teal)' }}>
                        Find {wordCount} {wordCount === 1 ? 'word' : 'words'}
                        {theme && (
                            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>— {theme}</span>
                        )}
                    </div>
                ) : findLine ? (
                    <div style={{ marginTop: 12, color: 'var(--teal)' }}>{findLine}</div>
                ) : null}
            </div>
            {!solved && (
                <form onSubmit={handleSubmit}>
                    {guesses.map((g, i) => (
                        <div key={i} className="action-btn">
                            <span className="gt">&gt;</span>
                            <input
                                type="text"
                                value={g}
                                onChange={(e) => handleGuessChange(i, e.target.value)}
                                placeholder="Found word..."
                                disabled={loading}
                                autoFocus={i === 0}
                                data-testid={i === 0 ? 'answer-input' : undefined}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    width: 'calc(100% - 30px)',
                                    letterSpacing: '0.1em',
                                }}
                            />
                        </div>
                    ))}
                    <button
                        type="submit"
                        className="action-btn"
                        disabled={loading || !allFilled}
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
