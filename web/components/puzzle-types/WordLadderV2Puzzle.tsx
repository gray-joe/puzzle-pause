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
type StepStatus = 'pending' | 'valid' | 'invalid';
type LetterHint = 'green' | 'amber' | 'grey';

function parseEndpoints(question: string): [string, string] | null {
    const words = question
        .split(',')
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean);
    return words.length === 2 ? [words[0], words[1]] : null;
}

function countDiff(a: string, b: string): number {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diff++;
    }
    return diff;
}

/** Checks the step from `word` (full length) is a valid one-letter change from `prev`, without knowing the true answer. */
function stepStatus(word: string, prev: string, wordLength: number): StepStatus {
    if (word.length !== wordLength || prev.length !== wordLength) return 'pending';
    return countDiff(word, prev) === 1 ? 'valid' : 'invalid';
}

/** Wordle-style per-letter hint against the target word: green = right letter/spot, amber = right letter/wrong spot. */
function letterHints(word: string, target: string, wordLength: number): (LetterHint | undefined)[] {
    const hints: (LetterHint | undefined)[] = new Array(wordLength).fill(undefined);
    const remaining: Record<string, number> = {};
    for (let i = 0; i < wordLength; i++) {
        const letter = word[i];
        if (!letter) continue;
        if (letter === target[i]) {
            hints[i] = 'green';
        } else {
            remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
        }
    }
    for (let i = 0; i < wordLength; i++) {
        const letter = word[i];
        if (!letter || hints[i]) continue;
        if (remaining[letter] > 0) {
            hints[i] = 'amber';
            remaining[letter] -= 1;
        } else {
            hints[i] = 'grey';
        }
    }
    return hints;
}

export default function WordLadderV2Puzzle({ puzzle, solved, onSubmit, loading }: Props) {
    const endpoints = parseEndpoints(puzzle.question);
    const [rows, setRows] = useState<Row[]>([{ id: 0, word: '' }]);
    const [nextId, setNextId] = useState(1);

    useEffect(() => {
        setRows([{ id: 0, word: '' }]);
        setNextId(1);
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
    }

    function addRow(afterIndex: number) {
        setRows((current) => [
            ...current.slice(0, afterIndex + 1),
            { id: nextId, word: '' },
            ...current.slice(afterIndex + 1),
        ]);
        setNextId((id) => id + 1);
    }

    function removeRow(id: number) {
        setRows((current) => current.filter((row) => row.id !== id));
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
        if (event.key !== 'Enter' || loading || solved) return;
        event.preventDefault();
        addRow(index);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        await onSubmit(rows.map((row) => row.word).join(', '));
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
                {rows.map((row, index) => {
                    const prevWord = index === 0 ? start : rows[index - 1].word;
                    const status = stepStatus(row.word, prevWord, wordLength);
                    const hints = letterHints(row.word, end, wordLength);
                    return (
                        <div key={row.id} className="ladder-grid-row-wrap">
                            <div className="ladder-grid-row">
                                <div className="ladder-grid">
                                    <div
                                        className={`ladder-grid-boxes ladder-grid-boxes--${status}`}
                                        data-testid={`ladder-v2-letters-${index}`}
                                        data-step-status={status}
                                    >
                                        {Array.from({ length: wordLength }).map(
                                            (_, letterIndex) => {
                                                const letter = row.word[letterIndex];
                                                const hint = hints[letterIndex];
                                                return (
                                                    <div
                                                        key={letterIndex}
                                                        className={`ladder-grid-box${
                                                            hint ? ` ladder-grid-box--${hint}` : ''
                                                        }`}
                                                        data-hint={hint}
                                                    >
                                                        {letter ? letter.toUpperCase() : ''}
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                    <input
                                        className="ladder-grid-input"
                                        value={row.word}
                                        onChange={(event) => updateWord(row.id, event.target.value)}
                                        onKeyDown={(event) => handleKeyDown(event, index)}
                                        aria-label={`Ladder word ${index + 1}`}
                                        data-testid="ladder-v2-input"
                                        maxLength={wordLength}
                                        disabled={loading || solved}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
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
                            {status === 'invalid' && (
                                <div
                                    className="ladder-grid-hint ladder-grid-hint--error"
                                    data-testid={`ladder-v2-hint-${index}`}
                                >
                                    Must change exactly one letter from the word above
                                </div>
                            )}
                        </div>
                    );
                })}
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
            <div className="muted" style={{ fontSize: '0.8em', marginBottom: 5 }}>
                {label}
            </div>
            <div className="ladder-grid-boxes" style={{ justifyContent: 'center' }}>
                {word.split('').map((letter, index) => (
                    <div key={index} className="ladder-grid-box ladder-grid-box--fixed">
                        {letter.toUpperCase()}
                    </div>
                ))}
            </div>
        </div>
    );
}
