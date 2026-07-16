'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type CellValue = string | null;

const GRID_SIZE = 16;
const DEFAULT_MISSING_INDEX = 10;

function defaultGrid(): CellValue[] {
    return Array.from({ length: GRID_SIZE }, (_, index) =>
        index === DEFAULT_MISSING_INDEX ? null : String(index + 1)
    );
}

function buildQuestion(prompt: string, grid: CellValue[]) {
    return JSON.stringify({
        prompt: prompt.trim() || 'What number is missing from this grid?',
        grid: grid.map((cell) => (cell === null ? null : Number(cell))),
    });
}

function parseQuestion(question: string): { prompt: string; grid: CellValue[] } | null {
    try {
        const parsed = JSON.parse(question) as { prompt?: unknown; grid?: unknown };
        if (typeof parsed.prompt !== 'string' || !Array.isArray(parsed.grid)) return null;
        const rawGrid = parsed.grid;

        const grid = Array.from({ length: GRID_SIZE }, (_, index) => {
            const cell = rawGrid[index];
            return cell === null ? null : String(cell ?? '');
        });

        if (!grid.some((cell) => cell === null)) grid[DEFAULT_MISSING_INDEX] = null;
        return { prompt: parsed.prompt, grid };
    } catch {
        return null;
    }
}

function normaliseNumber(value: string) {
    return value
        .replace(/[^0-9.-]/g, '')
        .replace(/(?!^)-/g, '')
        .replace(/(\..*)\./g, '$1');
}

export default function NumgridBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('What number is missing from this grid?');
    const [grid, setGrid] = useState<CellValue[]>(() => defaultGrid());
    const [missingAnswer, setMissingAnswer] = useState(answer);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt = parsed?.prompt ?? 'What number is missing from this grid?';
        const nextGrid = parsed?.grid ?? defaultGrid();
        const nextAnswer = answer || '';

        setPrompt(nextPrompt);
        setGrid(nextGrid);
        setMissingAnswer(nextAnswer);
        onChange(buildQuestion(nextPrompt, nextGrid), nextAnswer);
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextGrid: CellValue[], nextAnswer: string) {
        onChange(buildQuestion(nextPrompt, nextGrid), nextAnswer);
    }

    function handlePromptChange(value: string) {
        setPrompt(value);
        emit(value, grid, missingAnswer);
    }

    function handleCellChange(index: number, value: string) {
        const next = grid.map((cell, cellIndex) =>
            cellIndex === index ? normaliseNumber(value) : cell
        );
        setGrid(next);
        emit(prompt, next, missingAnswer);
    }

    function handleMissingIndexChange(index: number) {
        const currentAnswer = missingAnswer || (grid[index] ?? '');
        const next = grid.map((cell, cellIndex) => {
            if (cellIndex === index) return null;
            if (cell === null) return currentAnswer;
            return cell;
        });
        setGrid(next);
        setMissingAnswer(currentAnswer);
        emit(prompt, next, currentAnswer);
    }

    function handleAnswerChange(value: string) {
        const nextAnswer = normaliseNumber(value);
        setMissingAnswer(nextAnswer);
        emit(prompt, grid, nextAnswer);
    }

    return (
        <div
            data-testid="numgrid-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    data-testid="numgrid-prompt"
                    placeholder="What number is missing from this grid?"
                    style={{ width: '100%', maxWidth: 520 }}
                />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(56px, 72px))',
                    gap: 8,
                    overflowX: 'auto',
                }}
            >
                {grid.map((cell, index) => {
                    const isMissing = cell === null;
                    return (
                        <div
                            key={index}
                            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                        >
                            <input
                                type="text"
                                inputMode="decimal"
                                value={isMissing ? '?' : cell}
                                disabled={isMissing}
                                required={!isMissing}
                                onChange={(e) => handleCellChange(index, e.target.value)}
                                style={{
                                    height: 44,
                                    textAlign: 'center',
                                    border: isMissing
                                        ? '1px solid var(--teal)'
                                        : '1px solid var(--border)',
                                    background: isMissing ? 'rgba(78,204,163,0.08)' : undefined,
                                    color: isMissing ? 'var(--teal)' : undefined,
                                    fontWeight: isMissing ? 700 : undefined,
                                }}
                            />
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleMissingIndexChange(index)}
                                disabled={isMissing}
                                style={{ padding: '2px 4px', fontSize: '0.75em' }}
                            >
                                Missing
                            </button>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                    Missing number <span style={{ opacity: 0.6 }}>(stored as answer)</span>
                </label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={missingAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    required
                    data-testid="numgrid-answer"
                    placeholder="11"
                    style={{ width: 160 }}
                />
            </div>
        </div>
    );
}
