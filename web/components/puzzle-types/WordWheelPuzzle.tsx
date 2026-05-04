'use client';

import { useState } from 'react';
import { Puzzle } from '@/lib/api';
import { parseQuestion } from './parseQuestion';

interface WheelData {
    letters: (string | null)[];
}
interface WordWheelData {
    prompt: string;
    wheels: WheelData[];
}
interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (g: string) => void;
    loading: boolean;
}

function toRad(deg: number) {
    return (deg * Math.PI) / 180;
}

function WheelSvg({ letters, size = 170 }: { letters: (string | null)[]; size?: number }) {
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.46;
    const r = size * 0.19;
    const labelR = (R + r) / 2;
    const n = letters.length;
    const gap = 2.5; // degrees trimmed from each edge of a segment

    return (
        <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
            {letters.map((letter, i) => {
                const startRad = toRad((i * 360) / n - 90 + gap);
                const endRad = toRad(((i + 1) * 360) / n - 90 - gap);
                const midRad = (startRad + endRad) / 2;

                const ox1 = cx + R * Math.cos(startRad);
                const oy1 = cy + R * Math.sin(startRad);
                const ox2 = cx + R * Math.cos(endRad);
                const oy2 = cy + R * Math.sin(endRad);
                const ix2 = cx + r * Math.cos(endRad);
                const iy2 = cy + r * Math.sin(endRad);
                const ix1 = cx + r * Math.cos(startRad);
                const iy1 = cy + r * Math.sin(startRad);

                const d = [
                    `M ${ox1} ${oy1}`,
                    `A ${R} ${R} 0 0 1 ${ox2} ${oy2}`,
                    `L ${ix2} ${iy2}`,
                    `A ${r} ${r} 0 0 0 ${ix1} ${iy1}`,
                    'Z',
                ].join(' ');

                const lx = cx + labelR * Math.cos(midRad);
                const ly = cy + labelR * Math.sin(midRad);
                const missing = letter === null;

                return (
                    <g key={i}>
                        <path
                            d={d}
                            fill="transparent"
                            stroke={missing ? 'var(--orange)' : 'var(--border)'}
                            strokeWidth={missing ? 2 : 1.5}
                            strokeDasharray={missing ? '4 3' : undefined}
                        />
                        <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={missing ? 'var(--orange)' : 'var(--teal)'}
                            fontSize={size * 0.115}
                            fontFamily="inherit"
                            fontWeight="bold"
                        >
                            {missing ? '?' : letter}
                        </text>
                    </g>
                );
            })}
            <circle
                cx={cx}
                cy={cy}
                r={r * 0.6}
                fill="transparent"
                stroke="var(--border)"
                strokeWidth={1.5}
            />
        </svg>
    );
}

export default function WordWheelPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
    const data = parseQuestion<WordWheelData>(puzzle.question);
    const [words, setWords] = useState<string[]>(() => (data?.wheels ?? []).map(() => ''));

    if (!data)
        return (
            <div className="error" data-testid="puzzle-question">
                Invalid puzzle data.
            </div>
        );

    function handleSubmit() {
        onSubmit(words.map((w) => w.trim()).join(' '));
    }

    function handleKey(e: React.KeyboardEvent, i: number) {
        if (e.key === 'Enter' && i === data!.wheels.length - 1 && words.every((w) => w.trim())) {
            handleSubmit();
        }
    }

    const canSubmit = words.every((w) => w.trim().length > 0);

    return (
        <>
            <div className="puzzle-prompt" data-testid="puzzle-question">
                {data.prompt}
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 24,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 20,
                }}
            >
                {data.wheels.map((wheel, wi) => (
                    <div key={wi} style={{ textAlign: 'center' }}>
                        <WheelSvg letters={wheel.letters} />
                        <input
                            type="text"
                            value={words[wi]}
                            onChange={(e) => {
                                const next = [...words];
                                next[wi] = e.target.value.toUpperCase();
                                setWords(next);
                            }}
                            onKeyDown={(e) => handleKey(e, wi)}
                            disabled={solved}
                            placeholder="8-letter word"
                            maxLength={20}
                            style={{ marginTop: 12, width: 170, textAlign: 'center' }}
                            data-testid={`word-input-${wi}`}
                        />
                    </div>
                ))}
            </div>

            {!solved && (
                <button
                    className="action-btn"
                    onClick={handleSubmit}
                    disabled={loading || !canSubmit}
                    data-testid="submit-btn"
                >
                    <span className="gt">&gt;</span>
                    {loading ? 'Checking...' : 'Submit Words'}
                </button>
            )}
        </>
    );
}
