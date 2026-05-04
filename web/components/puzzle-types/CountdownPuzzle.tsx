'use client';

import { useState } from 'react';
import { Puzzle } from '@/lib/api';
import { parseQuestion } from './parseQuestion';

interface Props {
    puzzle: Puzzle;
    solved: boolean;
    onSubmit: (g: string) => void;
    onHint: () => void;
    loading: boolean;
}
interface CountdownData {
    prompt: string;
    target: number;
    numbers: number[];
    operators: string[];
}

const DISPLAY_TO_EVAL: Record<string, string> = { '×': '*', '÷': '/' };

function evalExpression(tokens: string[]): number | null {
    const expr = tokens.map((t) => DISPLAY_TO_EVAL[t] ?? t).join('');
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
    try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${expr})`)() as number;
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
        return null;
    }
}

export default function CountdownPuzzle({ puzzle, solved, onSubmit, onHint, loading }: Props) {
    const data = parseQuestion<CountdownData>(puzzle.question);
    const [tokens, setTokens] = useState<string[]>([]);
    const [usedNumbers, setUsedNumbers] = useState<number[]>([]);
    const [showTotal, setShowTotal] = useState(false);

    if (!data)
        return (
            <div className="error" data-testid="puzzle-question">
                Invalid puzzle data.
            </div>
        );

    function addNumber(n: number, idx: number) {
        if (usedNumbers.includes(idx)) return;
        setTokens((prev) => [...prev, String(n)]);
        setUsedNumbers((prev) => [...prev, idx]);
    }

    function addOperator(op: string) {
        setTokens((prev) => [...prev, op]);
    }

    function backspace() {
        if (tokens.length === 0) return;
        const last = tokens[tokens.length - 1];
        // If last token is a number, free up its tile
        const numIdx = data!.numbers.findIndex(
            (n, i) => String(n) === last && usedNumbers.includes(i)
        );
        if (numIdx !== -1) {
            setUsedNumbers((prev) => {
                const copy = [...prev];
                const pos = copy.lastIndexOf(numIdx);
                if (pos !== -1) copy.splice(pos, 1);
                return copy;
            });
        }
        setTokens((prev) => prev.slice(0, -1));
    }

    function clear() {
        setTokens([]);
        setUsedNumbers([]);
    }

    function handleSubmit() {
        const result = evalExpression(tokens);
        if (result === null) return;
        onSubmit(String(result));
    }

    const result = tokens.length > 0 ? evalExpression(tokens) : null;

    const tileBase: React.CSSProperties = {
        border: '2px solid var(--border)',
        borderRadius: 6,
        fontWeight: 'bold',
        cursor: 'pointer',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        width: 56,
        height: 56,
        fontSize: '1.4em',
    };

    return (
        <>
            <div className="content-meta" data-testid="puzzle-question">
                {data.prompt}
            </div>

            {/* Target */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div
                    data-testid="target-number"
                    style={{
                        display: 'inline-block',
                        fontSize: '2.8em',
                        fontWeight: 'bold',
                        padding: '12px 40px',
                        border: '3px solid var(--teal)',
                        borderRadius: 8,
                        color: 'var(--teal)',
                        minWidth: 120,
                    }}
                >
                    {data.target}
                </div>
            </div>

            {/* Number tiles */}
            <div
                style={{
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 10,
                }}
            >
                {data.numbers.map((n, i) => {
                    const used = usedNumbers.includes(i);
                    return (
                        <button
                            key={i}
                            data-testid={`number-tile-${i}`}
                            onClick={() => addNumber(n, i)}
                            disabled={solved || loading || used}
                            style={{
                                ...tileBase,
                                opacity: used ? 0.35 : 1,
                                cursor: used ? 'default' : 'pointer',
                            }}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>

            {/* Operator and bracket tiles */}
            <div
                style={{
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 16,
                }}
            >
                {data.operators.map((op, i) => (
                    <button
                        key={i}
                        data-testid={`operator-tile-${i}`}
                        onClick={() => addOperator(op)}
                        disabled={solved || loading}
                        style={{ ...tileBase }}
                    >
                        {op}
                    </button>
                ))}
                {['(', ')'].map((bracket) => (
                    <button
                        key={bracket}
                        data-testid={`bracket-tile-${bracket}`}
                        onClick={() => addOperator(bracket)}
                        disabled={solved || loading}
                        style={{ ...tileBase, color: 'var(--muted)' }}
                    >
                        {bracket}
                    </button>
                ))}
            </div>

            {/* Expression area */}
            {!solved && (
                <>
                    <div
                        data-testid="expression-display"
                        style={{
                            minHeight: 48,
                            border: '2px solid var(--border)',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: '1.2em',
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                        }}
                    >
                        <span style={{ color: tokens.length === 0 ? 'var(--muted)' : undefined }}>
                            {tokens.length > 0
                                ? tokens.join(' ')
                                : 'Click tiles to build your expression…'}
                        </span>
                        {showTotal && result !== null && (
                            <span
                                data-testid="expression-result"
                                style={{
                                    color: 'var(--teal)',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                = {result}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <button
                            className="action-btn"
                            onClick={backspace}
                            disabled={tokens.length === 0}
                            style={{ flex: 1 }}
                        >
                            <span className="gt">&gt;</span>Backspace
                        </button>
                        <button
                            className="action-btn"
                            onClick={clear}
                            disabled={tokens.length === 0}
                            style={{ flex: 1 }}
                        >
                            <span className="gt">&gt;</span>Clear
                        </button>
                        {!showTotal && (
                            <button
                                className="action-btn secondary"
                                onClick={() => setShowTotal(true)}
                                data-testid="show-total-btn"
                                style={{ flex: 1 }}
                            >
                                <span className="gt">&gt;</span>Show total
                                <span className="muted"> (-10 pts)</span>
                            </button>
                        )}
                    </div>
                    <button
                        className="action-btn"
                        onClick={handleSubmit}
                        disabled={loading || result === null}
                        data-testid="submit-btn"
                    >
                        <span className="gt">&gt;</span>
                        {loading ? 'Checking...' : 'Submit'}
                    </button>
                </>
            )}
        </>
    );
}
