'use client';

import { useState, useEffect, useCallback } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

function parseQuestion(question: string): { grid: string[][]; rows: number; cols: number } | null {
    const lines = question
        .split('\n')
        .filter(
            (l) =>
                !l.startsWith('Find:') &&
                !l.startsWith('find:') &&
                !l.startsWith('Theme:') &&
                !l.startsWith('theme:') &&
                l.trim()
        );
    if (!lines.length) return null;
    const grid = lines.map((l) => l.trim().split(/\s+/));
    const cols = Math.max(...grid.map((r) => r.length));
    return { grid, rows: grid.length, cols };
}

function parseAnswer(answer: string): string[] {
    if (!answer) return [''];
    if (answer.startsWith('~')) return answer.slice(1).split(' ').filter(Boolean);
    return [answer.toUpperCase()];
}

function findWordInGrid(grid: string[][], word: string): { r: number; c: number }[] | null {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const w = word.toUpperCase();
    const directions = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            for (const [dr, dc] of directions) {
                const cells: { r: number; c: number }[] = [];
                let match = true;
                for (let i = 0; i < w.length; i++) {
                    const nr = r + dr * i;
                    const nc = c + dc * i;
                    if (
                        nr < 0 ||
                        nr >= rows ||
                        nc < 0 ||
                        nc >= cols ||
                        (grid[nr][nc] ?? '') !== w[i]
                    ) {
                        match = false;
                        break;
                    }
                    cells.push({ r: nr, c: nc });
                }
                if (match) return cells;
            }
        }
    }
    return null;
}

function buildQuestion(grid: string[][], words: string[], theme: string): string {
    const rows = grid.map((row) => row.map((c) => (c || '?').toUpperCase()).join(' '));
    const count = words.filter((w) => w.length > 0).length;
    const lines = [...rows, `Find: ${count}`];
    if (theme.trim()) lines.push(`Theme: ${theme.trim()}`);
    return lines.join('\n');
}

function buildAnswer(words: string[]): string {
    const filtered = words.filter((w) => w.length > 0).map((w) => w.toUpperCase());
    if (filtered.length <= 1) return filtered[0] ?? '';
    return '~' + filtered.join(' ');
}

function emptyGrid(rows: number, cols: number): string[][] {
    return Array.from({ length: rows }, () => Array(cols).fill(''));
}

export default function WordsearchBuilder({ question, answer, onChange }: Props) {
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(10);
    const [grid, setGrid] = useState<string[][]>(() => emptyGrid(10, 10));
    const [words, setWords] = useState<string[]>(['']);
    const [theme, setTheme] = useState('');
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);
        const allLines = question ? question.split('\n') : [];
        const themeLine = allLines.find((l) => l.startsWith('Theme:') || l.startsWith('theme:'));
        if (themeLine) setTheme(themeLine.replace(/^theme:\s*/i, '').trim());
        const parsed = question ? parseQuestion(question) : null;
        if (parsed) {
            setRows(parsed.rows);
            setCols(parsed.cols);
            const normalised = parsed.grid.map((row) => {
                const padded = [...row];
                while (padded.length < parsed.cols) padded.push('');
                return padded;
            });
            setGrid(normalised);
        }
        if (answer) setWords(parseAnswer(answer));
    }, [question, answer, initialised]);

    const allHighlights = words.flatMap((w) =>
        w.length >= 2 ? (findWordInGrid(grid, w) ?? []) : []
    );
    const isHighlighted = (r: number, c: number) =>
        !!allHighlights.some((cell) => cell.r === r && cell.c === c);

    const emit = useCallback(
        (nextGrid: string[][], nextWords: string[], nextTheme: string) => {
            onChange(buildQuestion(nextGrid, nextWords, nextTheme), buildAnswer(nextWords));
        },
        [onChange]
    );

    function handleCellChange(r: number, c: number, val: string) {
        const letter = val
            .replace(/[^a-zA-Z]/g, '')
            .slice(-1)
            .toUpperCase();
        const next = grid.map((row, ri) =>
            ri === r ? row.map((cell, ci) => (ci === c ? letter : cell)) : row
        );
        setGrid(next);
        emit(next, words, theme);
    }

    function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
        if (e.key === 'Backspace') {
            const cell = grid[r][c];
            if (!cell) {
                const prevC = c - 1;
                const prevR = prevC < 0 ? r - 1 : r;
                const adjC = prevC < 0 ? cols - 1 : prevC;
                if (prevR >= 0) {
                    const el = document.getElementById(`ws-cell-${prevR}-${adjC}`);
                    el?.focus();
                }
            }
        } else if (e.key === 'ArrowRight') {
            document.getElementById(`ws-cell-${r}-${Math.min(c + 1, cols - 1)}`)?.focus();
        } else if (e.key === 'ArrowLeft') {
            document.getElementById(`ws-cell-${r}-${Math.max(c - 1, 0)}`)?.focus();
        } else if (e.key === 'ArrowDown') {
            document.getElementById(`ws-cell-${Math.min(r + 1, rows - 1)}-${c}`)?.focus();
        } else if (e.key === 'ArrowUp') {
            document.getElementById(`ws-cell-${Math.max(r - 1, 0)}-${c}`)?.focus();
        }
    }

    function handleCellInput(e: React.FormEvent<HTMLInputElement>, r: number, c: number) {
        const val = e.currentTarget.value
            .replace(/[^a-zA-Z]/g, '')
            .slice(-1)
            .toUpperCase();
        if (val) {
            const nextC = c + 1 < cols ? c + 1 : 0;
            const nextR = c + 1 < cols ? r : r + 1;
            if (nextR < rows) {
                document.getElementById(`ws-cell-${nextR}-${nextC}`)?.focus();
            }
        }
    }

    function handleResizeRows(newRows: number) {
        setRows(newRows);
        const next = Array.from({ length: newRows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => grid[r]?.[c] ?? '')
        );
        setGrid(next);
        emit(next, words, theme);
    }

    function handleResizeCols(newCols: number) {
        setCols(newCols);
        const next = grid.map((row) => Array.from({ length: newCols }, (_, c) => row[c] ?? ''));
        setGrid(next);
        emit(next, words, theme);
    }

    function handleWordChange(index: number, val: string) {
        const upper = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
        const next = words.map((w, i) => (i === index ? upper : w));
        setWords(next);
        emit(grid, next, theme);
    }

    function handleAddWord() {
        const next = [...words, ''];
        setWords(next);
        emit(grid, next, theme);
    }

    function handleRemoveWord(index: number) {
        const next = words.filter((_, i) => i !== index);
        const safe = next.length ? next : [''];
        setWords(safe);
        emit(grid, safe, theme);
    }

    function handleThemeChange(val: string) {
        setTheme(val);
        emit(grid, words, val);
    }

    function handleFillRandom() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const next = grid.map((row) =>
            row.map((c) => (c ? c : letters[Math.floor(Math.random() * 26)]))
        );
        setGrid(next);
        emit(next, words, theme);
    }

    function handleClear() {
        const next = emptyGrid(rows, cols);
        setGrid(next);
        emit(next, words, theme);
    }

    const cellSize = 32;
    const gap = 4;

    return (
        <div data-testid="wordsearch-builder">
            {/* Controls */}
            <div
                style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                }}
            >
                <label
                    style={{ color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}
                >
                    Rows
                    <input
                        type="number"
                        min={5}
                        max={15}
                        value={rows}
                        onChange={(e) =>
                            handleResizeRows(Math.min(15, Math.max(5, Number(e.target.value))))
                        }
                        style={{ width: 56 }}
                    />
                </label>
                <label
                    style={{ color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}
                >
                    Cols
                    <input
                        type="number"
                        min={5}
                        max={15}
                        value={cols}
                        onChange={(e) =>
                            handleResizeCols(Math.min(15, Math.max(5, Number(e.target.value))))
                        }
                        style={{ width: 56 }}
                    />
                </label>
                <button
                    type="button"
                    className="action-btn"
                    onClick={handleFillRandom}
                    style={{ padding: '4px 10px' }}
                >
                    Fill empty randomly
                </button>
                <button
                    type="button"
                    className="action-btn"
                    onClick={handleClear}
                    style={{ padding: '4px 10px' }}
                >
                    Clear grid
                </button>
            </div>

            {/* Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                    gap,
                    marginBottom: 16,
                    overflowX: 'auto',
                }}
            >
                {grid.map((row, r) =>
                    row.map((cell, c) => (
                        <input
                            key={`${r}-${c}`}
                            id={`ws-cell-${r}-${c}`}
                            data-testid={`wordsearch-cell-${r}-${c}`}
                            type="text"
                            maxLength={2}
                            value={cell}
                            onChange={(e) => handleCellChange(r, c, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                            onInput={(e) => handleCellInput(e, r, c)}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                textAlign: 'center',
                                fontFamily: 'inherit',
                                fontSize: '0.95em',
                                letterSpacing: 0,
                                padding: 0,
                                background: isHighlighted(r, c) ? 'var(--teal)' : undefined,
                                color: isHighlighted(r, c) ? 'var(--bg)' : undefined,
                                fontWeight: isHighlighted(r, c) ? 700 : undefined,
                                border: '1px solid var(--border)',
                                boxSizing: 'border-box',
                            }}
                        />
                    ))
                )}
            </div>

            {/* Words to find (hidden from players — stored as answer) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                    Words to find{' '}
                    <span style={{ opacity: 0.6 }}>(stored as answer — not shown to players)</span>
                </div>
                {words.map((word, index) => {
                    const wordValid = word.length >= 2 && findWordInGrid(grid, word) !== null;
                    const wordMissing = word.length >= 2 && findWordInGrid(grid, word) === null;
                    return (
                        <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="text"
                                value={word}
                                onChange={(e) => handleWordChange(index, e.target.value)}
                                data-testid={`wordsearch-word-${index}`}
                                placeholder="EARTH"
                                style={{ width: 160, letterSpacing: '0.1em' }}
                            />
                            {words.length > 1 && (
                                <button
                                    type="button"
                                    className="action-btn"
                                    onClick={() => handleRemoveWord(index)}
                                    style={{ padding: '2px 8px', fontSize: '0.85em' }}
                                >
                                    Remove
                                </button>
                            )}
                            {wordValid && (
                                <span style={{ color: 'var(--teal)', fontSize: '0.9em' }}>
                                    found in grid
                                </span>
                            )}
                            {wordMissing && (
                                <span style={{ color: 'var(--red, #e05)', fontSize: '0.9em' }}>
                                    not found in grid
                                </span>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="action-btn"
                    onClick={handleAddWord}
                    style={{ padding: '4px 10px', alignSelf: 'flex-start', marginTop: 4 }}
                >
                    + Add word
                </button>
            </div>

            {/* Theme / prompt shown to players */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                    Theme / prompt{' '}
                    <span style={{ opacity: 0.6 }}>
                        (shown to players alongside the word count)
                    </span>
                </label>
                <input
                    type="text"
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    data-testid="wordsearch-theme"
                    placeholder="e.g. Countries of Europe"
                    style={{ width: '100%', maxWidth: 400 }}
                />
            </div>
        </div>
    );
}
