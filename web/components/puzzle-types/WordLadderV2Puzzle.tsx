'use client';

import { useEffect, useState } from 'react';
import { AttemptResult, Puzzle } from '@/lib/api';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (guess: string) => Promise<AttemptResult | undefined>;
    loading: boolean;
}

type Row = { id: number; word: string };

function parseEndpoints(question: string): [string, string] | null {
    const words = question
        .split(',')
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean);
    return words.length === 2 ? [words[0], words[1]] : null;
}

export default function WordLadderV2Puzzle({ puzzle, solved, onSubmit, loading }: Props) {
    const endpoints = parseEndpoints(puzzle.question);
    const [rows, setRows] = useState<Row[]>([{ id: 0, word: '' }]);
    const [nextId, setNextId] = useState(1);
    const [letterFeedback, setLetterFeedback] = useState<boolean[][]>([]);

    useEffect(() => {
        setRows([{ id: 0, word: '' }]);
        setNextId(1);
        setLetterFeedback([]);
    }, [puzzle.id]);

    if (!endpoints || endpoints[0].length !== endpoints[1].length) {
        return (
            <div className="puzzle-box error" data-testid="puzzle-question">
                Invalid word ladder
            </div>
        );
    }

    const [start, end] = endpoints;
    const wordLength = start.length;

    function updateWord(id: number, value: string) {
        const word = value
            .replace(/[^a-z]/gi, '')
            .slice(0, wordLength)
            .toLowerCase();
        setRows((current) => current.map((row) => (row.id === id ? { ...row, word } : row)));
        setLetterFeedback([]);
    }

    function addRow(afterIndex: number) {
        setRows((current) => [
            ...current.slice(0, afterIndex + 1),
            { id: nextId, word: '' },
            ...current.slice(afterIndex + 1),
        ]);
        setNextId((id) => id + 1);
        setLetterFeedback([]);
    }

    function removeRow(id: number) {
        setRows((current) => current.filter((row) => row.id !== id));
        setLetterFeedback([]);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        const result = await onSubmit(rows.map((row) => row.word).join(', '));
        setLetterFeedback(result?.letter_feedback ?? []);
    }

    const complete = rows.every((row) => row.word.length === wordLength);

    return (
        <>
            <div
                className="puzzle-box"
                data-testid="puzzle-question"
                style={{ flexDirection: 'column', gap: 10 }}
            >
                <WordRow word={start} label="Start" />
                {rows.map((row, index) => (
                    <div
                        key={row.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            width: '100%',
                        }}
                    >
                        <div style={{ flex: 1, maxWidth: 240 }}>
                            <input
                                value={row.word}
                                onChange={(event) => updateWord(row.id, event.target.value)}
                                aria-label={`Ladder word ${index + 1}`}
                                data-testid="ladder-v2-input"
                                maxLength={wordLength}
                                disabled={loading || solved}
                                autoComplete="off"
                                spellCheck={false}
                                style={{
                                    width: '100%',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.2em',
                                }}
                            />
                            {row.word && (
                                <div
                                    data-testid={`ladder-v2-letters-${index}`}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: 4,
                                        marginTop: 5,
                                    }}
                                >
                                    {row.word.split('').map((letter, letterIndex) => (
                                        <span
                                            key={letterIndex}
                                            data-correct={
                                                letterFeedback[index]?.[letterIndex] || undefined
                                            }
                                            style={{
                                                color: letterFeedback[index]?.[letterIndex]
                                                    ? '#16803c'
                                                    : undefined,
                                                fontWeight: letterFeedback[index]?.[letterIndex]
                                                    ? 700
                                                    : undefined,
                                            }}
                                        >
                                            {letter.toUpperCase()}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() => addRow(index)}
                            disabled={loading || solved}
                            aria-label={`Add word after row ${index + 1}`}
                            data-testid="add-ladder-row"
                            style={{ width: 'auto', padding: '4px 10px' }}
                        >
                            +
                        </button>
                        {rows.length > 1 && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => removeRow(row.id)}
                                disabled={loading || solved}
                                aria-label={`Remove word ${index + 1}`}
                                data-testid="remove-ladder-row"
                                style={{ width: 'auto', padding: '4px 10px' }}
                            >
                                −
                            </button>
                        )}
                    </div>
                ))}
                <WordRow word={end} label="End" />
                <div className="muted" style={{ fontSize: '0.9em' }}>
                    Change one letter at a time. Every row must be an English word.
                </div>
            </div>
            {!solved && (
                <form onSubmit={handleSubmit}>
                    <button
                        type="submit"
                        className="action-btn"
                        disabled={loading || !complete}
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

function WordRow({ word, label }: { word: string; label: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: '0.8em' }}>
                {label}
            </div>
            <strong style={{ letterSpacing: '0.2em' }}>{word.toUpperCase()}</strong>
        </div>
    );
}
