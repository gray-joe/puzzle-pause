'use client';

import { useRef, useState } from 'react';
import { AttemptResult, Puzzle } from '@/lib/api';
import { parseQuestion } from './parseQuestion';
import { buildCrossword, CrosswordData, Direction } from './crossword';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (guess: string) => Promise<AttemptResult | undefined>;
    loading: boolean;
}

const CELL_SIZE = 40;

function gridStyle(cols: number): React.CSSProperties {
    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        width: `min(100%, ${cols * CELL_SIZE}px)`,
        border: '2px solid var(--border)',
        margin: '16px 0',
    };
}

function cellStyle(black: boolean, background = 'transparent'): React.CSSProperties {
    return {
        position: 'relative',
        aspectRatio: '1',
        border: '1px solid var(--border)',
        background: black ? 'var(--border)' : background,
    };
}

function CellNumber({ number }: { number: string | null }) {
    if (!number) return null;
    return (
        <span
            style={{
                position: 'absolute',
                top: 1,
                left: 2,
                fontSize: '0.55em',
                lineHeight: 1,
                pointerEvents: 'none',
            }}
        >
            {number}
        </span>
    );
}

export default function CrosswordPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
    const data = parseQuestion<CrosswordData>(puzzle.question);
    const layout = data?.layout ?? [];
    const { cols, numbers, words } = buildCrossword(layout);
    const flat = layout.join('');
    const [letters, setLetters] = useState<string[]>(() => Array(flat.length).fill(''));
    const [active, setActive] = useState(-1);
    const [direction, setDirection] = useState<Direction>('across');
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    if (!data || !words.length) {
        return (
            <div className="error" data-testid="puzzle-question">
                Invalid puzzle data.
            </div>
        );
    }

    const wordAt = (cell: number, dir: Direction) =>
        words.find((w) => w.direction === dir && w.cells.includes(cell));
    const activeWord = wordAt(active, direction) ?? wordAt(active, other(direction));
    const activeDirection = activeWord?.direction ?? direction;
    const disabled = loading || solved;

    function other(dir: Direction): Direction {
        return dir === 'across' ? 'down' : 'across';
    }

    function focus(cell: number) {
        if (cell < 0 || cell >= flat.length || flat[cell] !== '.') return;
        setActive(cell);
        inputs.current[cell]?.focus();
    }

    function step(cell: number, delta: number, dir: Direction) {
        const word = wordAt(cell, dir);
        if (!word) return;
        const next = word.cells[word.cells.indexOf(cell) + delta];
        if (next !== undefined) focus(next);
    }

    function handleFocus(cell: number) {
        setActive(cell);
        if (!wordAt(cell, direction)) setDirection(other(direction));
    }

    // On mousedown, before focus moves: only a press on the already-active cell toggles.
    function handleMouseDown(cell: number) {
        if (cell === active && wordAt(cell, other(direction))) setDirection(other(direction));
    }

    function setLetter(cell: number, letter: string) {
        setLetters((current) => current.map((l, i) => (i === cell ? letter : l)));
        if (letter) step(cell, 1, activeDirection);
    }

    // Fallback for mobile keyboards, which don't report the key in onKeyDown.
    // Drop the existing letter first: the caret may sit before or after it.
    function handleChange(cell: number, value: string) {
        setLetter(
            cell,
            value
                .replace(letters[cell], '')
                .replace(/[^a-z]/gi, '')
                .slice(-1)
                .toUpperCase()
        );
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, cell: number) {
        if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            setLetter(cell, e.key.toUpperCase());
            return;
        }
        const moves: Record<string, [number, Direction]> = {
            ArrowRight: [1, 'across'],
            ArrowLeft: [-1, 'across'],
            ArrowDown: [cols, 'down'],
            ArrowUp: [-cols, 'down'],
        };
        if (e.key in moves) {
            e.preventDefault();
            const [delta, dir] = moves[e.key];
            if (dir !== activeDirection && wordAt(cell, dir)) {
                setDirection(dir);
                return;
            }
            // Skip over black squares; stay within the row for left/right.
            for (let next = cell + delta; next >= 0 && next < flat.length; next += delta) {
                if (dir === 'across' && Math.floor(next / cols) !== Math.floor(cell / cols)) return;
                if (flat[next] === '.') return focus(next);
            }
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            if (letters[cell]) {
                setLetter(cell, '');
            } else {
                const word = wordAt(cell, activeDirection);
                const prev = word?.cells[word.cells.indexOf(cell) - 1];
                if (prev !== undefined) {
                    setLetters((current) => current.map((l, i) => (i === prev ? '' : l)));
                    focus(prev);
                }
            }
        }
    }

    const guess = letters.map((l, i) => (flat[i] === '#' ? '#' : l)).join('');
    const complete = letters.every((l, i) => flat[i] === '#' || l);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (complete) onSubmit(guess);
    }

    return (
        <>
            <div className="puzzle-prompt" data-testid="puzzle-question">
                {data.prompt}
            </div>

            {activeWord && (
                <div className="content-meta" data-testid="crossword-active-clue">
                    <span style={{ color: 'var(--teal)' }}>
                        {activeWord.number} {activeWord.direction}:
                    </span>{' '}
                    {data.clues[activeWord.direction][activeWord.number]}
                </div>
            )}

            <div style={gridStyle(cols)} data-testid="crossword-grid">
                {flat.split('').map((ch, i) => {
                    if (ch === '#') return <div key={i} style={cellStyle(true)} />;
                    const highlight =
                        i === active
                            ? 'rgba(78,204,163,0.35)'
                            : activeWord?.cells.includes(i)
                              ? 'rgba(78,204,163,0.12)'
                              : undefined;
                    return (
                        <div key={i} style={cellStyle(false, highlight)}>
                            <CellNumber number={numbers[i]} />
                            <input
                                ref={(el) => {
                                    inputs.current[i] = el;
                                }}
                                value={letters[i]}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, i)}
                                onFocus={() => handleFocus(i)}
                                onMouseDown={() => handleMouseDown(i)}
                                disabled={disabled}
                                aria-label={`Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}`}
                                data-testid={`crossword-cell-${i}`}
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'center',
                                    fontSize: '1.1em',
                                    textTransform: 'uppercase',
                                    caretColor: 'transparent',
                                    padding: 0,
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 16 }}
                data-testid="crossword-clues"
            >
                {(['across', 'down'] as const).map((dir) => (
                    <div key={dir} style={{ flex: '1 1 200px' }}>
                        <div style={{ color: 'var(--teal)', marginBottom: 6 }}>
                            {dir === 'across' ? 'Across' : 'Down'}
                        </div>
                        {words
                            .filter((w) => w.direction === dir)
                            .map((w) => (
                                <button
                                    key={w.number}
                                    type="button"
                                    onClick={() => {
                                        setDirection(dir);
                                        focus(w.cells[0]);
                                    }}
                                    disabled={disabled}
                                    style={{
                                        display: 'block',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        padding: '2px 0',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        fontWeight: w === activeWord ? 'bold' : undefined,
                                    }}
                                >
                                    {w.number}. {data.clues[dir][w.number]}
                                </button>
                            ))}
                    </div>
                ))}
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

/** Read-only filled grid for the result panel. */
export function CrosswordSolution({ question, answer }: { question: string; answer: string }) {
    const data = parseQuestion<CrosswordData>(question);
    if (!data) return null;
    const { cols, numbers } = buildCrossword(data.layout);
    return (
        <div style={gridStyle(cols)} data-testid="crossword-solution">
            {answer.split('').map((ch, i) =>
                ch === '#' ? (
                    <div key={i} style={cellStyle(true)} />
                ) : (
                    <div
                        key={i}
                        style={{
                            ...cellStyle(false),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--teal)',
                        }}
                    >
                        <CellNumber number={numbers[i]} />
                        {ch}
                    </div>
                )
            )}
        </div>
    );
}
