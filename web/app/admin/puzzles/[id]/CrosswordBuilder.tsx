'use client';

import { useEffect, useState } from 'react';
import {
    buildCrossword,
    CrosswordData,
    CrosswordWord,
    Direction,
} from '@/components/puzzle-types/crossword';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

const DEFAULT_GRID = 'CAT\nA#O\nBOW';

// Clues are keyed by answer text while editing so they follow their word when the grid
// renumbers; they're converted back to numbers on save.
// ponytail: a repeated answer in the same direction shares one clue.
type CluesByWord = Record<Direction, Record<string, string>>;

const wordText = (w: CrosswordWord, letters: string) => w.cells.map((i) => letters[i]).join('');

function parseInitial(question: string, answer: string) {
    try {
        const data = JSON.parse(question) as Partial<CrosswordData>;
        const layout = data.layout!;
        const cols = layout[0].length;
        const rows = answer.match(new RegExp(`.{1,${cols}}`, 'g')) ?? [];
        const clues: CluesByWord = { across: {}, down: {} };
        for (const w of buildCrossword(layout).words) {
            const text = data.clues?.[w.direction]?.[w.number];
            if (text) clues[w.direction][wordText(w, answer)] = text;
        }
        return { prompt: data.prompt ?? '', grid: rows.join('\n'), clues };
    } catch {
        return { prompt: 'Mini crossword', grid: DEFAULT_GRID, clues: { across: {}, down: {} } };
    }
}

export default function CrosswordBuilder({ question, answer, onChange }: Props) {
    const [initial] = useState(() => parseInitial(question, answer));
    const [prompt, setPrompt] = useState(initial.prompt);
    const [grid, setGrid] = useState(initial.grid);
    const [clues, setClues] = useState<CluesByWord>(initial.clues);

    const rows = grid
        .toUpperCase()
        .split('\n')
        .map((row) => row.replace(/[^A-Z#]/g, ''))
        .filter(Boolean);
    const letters = rows.join('');
    const layout = rows.map((row) => row.replace(/[A-Z]/g, '.'));
    const { words } = buildCrossword(layout);

    useEffect(() => {
        const numbered = (dir: Direction) =>
            Object.fromEntries(
                words
                    .filter((w) => w.direction === dir)
                    .map((w) => [w.number, clues[dir][wordText(w, letters)] ?? ''])
            );
        onChange(
            JSON.stringify({
                prompt,
                layout,
                clues: { across: numbered('across'), down: numbered('down') },
            }),
            letters
        );
        // layout/rows/words are derived from grid on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prompt, grid, clues, onChange]);

    function setClue(dir: Direction, word: string, text: string) {
        setClues((current) => ({ ...current, [dir]: { ...current[dir], [word]: text } }));
    }

    return (
        <div
            data-testid="crossword-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
            <label>
                Prompt
                <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    data-testid="crossword-prompt"
                    style={{ width: '100%' }}
                />
            </label>
            <label>
                Grid (one row per line, letters for answers, # for black squares)
                <textarea
                    value={grid}
                    onChange={(e) => setGrid(e.target.value)}
                    rows={Math.max(rows.length, 3) + 1}
                    data-testid="crossword-grid-input"
                    style={{ width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
            </label>
            {(['across', 'down'] as const).map((dir) => (
                <div key={dir}>
                    <div style={{ marginBottom: 4 }}>{dir === 'across' ? 'Across' : 'Down'}</div>
                    {words
                        .filter((w) => w.direction === dir)
                        .map((w) => [w, wordText(w, letters)] as const)
                        .map(([w, text]) => (
                            <label
                                key={w.number}
                                style={{ display: 'flex', gap: 8, marginBottom: 4 }}
                            >
                                <span style={{ minWidth: 110 }}>
                                    {w.number}. {text}
                                </span>
                                <input
                                    value={clues[dir][text] ?? ''}
                                    onChange={(e) => setClue(dir, text, e.target.value)}
                                    data-testid={`crossword-clue-${dir}-${w.number}`}
                                    style={{ flex: 1 }}
                                />
                            </label>
                        ))}
                </div>
            ))}
            <div className="muted" style={{ fontSize: '0.9em' }}>
                Clue numbers update as you edit the grid. Rows must all be the same length (3–15).
            </div>
        </div>
    );
}
