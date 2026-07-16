'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type Pair = {
    left: string;
    right: string;
};

type MatchQuestion = {
    prompt: string;
    left: string[];
    right: string[];
};

const MIN_PAIRS = 2;

function parseQuestion(question: string): MatchQuestion | null {
    try {
        const parsed = JSON.parse(question) as {
            prompt?: unknown;
            left?: unknown;
            right?: unknown;
        };
        if (
            typeof parsed.prompt !== 'string' ||
            !Array.isArray(parsed.left) ||
            !Array.isArray(parsed.right) ||
            parsed.left.length !== parsed.right.length ||
            parsed.left.length < MIN_PAIRS
        ) {
            return null;
        }

        return {
            prompt: parsed.prompt,
            left: parsed.left.map((item) => String(item ?? '')),
            right: parsed.right.map((item) => String(item ?? '')),
        };
    } catch {
        return null;
    }
}

function parseAnswer(answer: string, pairCount: number) {
    const indices = answer
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((index) => Number.isInteger(index));
    const valid =
        indices.length === pairCount &&
        new Set(indices).size === pairCount &&
        indices.every((index) => index >= 0 && index < pairCount);

    return valid ? indices : Array.from({ length: pairCount }, (_, index) => index);
}

function parsePairs(question: string, answer: string) {
    const parsed = question ? parseQuestion(question) : null;
    if (!parsed) {
        return {
            prompt: 'Match these:',
            pairs: [
                { left: 'A', right: '1' },
                { left: 'B', right: '2' },
            ],
            rightOrder: [0, 1],
        };
    }

    const answerIndices = parseAnswer(answer, parsed.left.length);
    const pairs = parsed.left.map((left, leftIndex) => ({
        left,
        right: parsed.right[answerIndices[leftIndex]] ?? '',
    }));
    const rightOrder = Array.from({ length: parsed.right.length }, (_, rightIndex) =>
        Math.max(0, answerIndices.indexOf(rightIndex))
    );

    return { prompt: parsed.prompt, pairs, rightOrder };
}

function buildQuestion(prompt: string, pairs: Pair[], rightOrder: number[]) {
    return JSON.stringify({
        prompt: prompt.trim() || 'Match these:',
        left: pairs.map((pair) => pair.left.trim()),
        right: rightOrder.map((pairIndex) => pairs[pairIndex]?.right.trim() ?? ''),
    });
}

function buildAnswer(pairs: Pair[], rightOrder: number[]) {
    return pairs.map((_, pairIndex) => rightOrder.indexOf(pairIndex)).join(',');
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    return next;
}

export default function MatchBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('Match these:');
    const [pairs, setPairs] = useState<Pair[]>([
        { left: 'A', right: '1' },
        { left: 'B', right: '2' },
    ]);
    const [rightOrder, setRightOrder] = useState<number[]>([0, 1]);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = parsePairs(question, answer);
        setPrompt(parsed.prompt);
        setPairs(parsed.pairs);
        setRightOrder(parsed.rightOrder);
        onChange(
            buildQuestion(parsed.prompt, parsed.pairs, parsed.rightOrder),
            buildAnswer(parsed.pairs, parsed.rightOrder)
        );
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextPairs: Pair[], nextRightOrder: number[]) {
        onChange(
            buildQuestion(nextPrompt, nextPairs, nextRightOrder),
            buildAnswer(nextPairs, nextRightOrder)
        );
    }

    function handlePromptChange(value: string) {
        setPrompt(value);
        emit(value, pairs, rightOrder);
    }

    function handlePairChange(index: number, field: keyof Pair, value: string) {
        const nextPairs = pairs.map((pair, pairIndex) =>
            pairIndex === index ? { ...pair, [field]: value } : pair
        );
        setPairs(nextPairs);
        emit(prompt, nextPairs, rightOrder);
    }

    function handleAddPair() {
        const nextPairs = [...pairs, { left: `Item ${pairs.length + 1}`, right: '' }];
        const nextRightOrder = [...rightOrder, nextPairs.length - 1];
        setPairs(nextPairs);
        setRightOrder(nextRightOrder);
        emit(prompt, nextPairs, nextRightOrder);
    }

    function handleRemovePair(index: number) {
        if (pairs.length <= MIN_PAIRS) return;
        const nextPairs = pairs.filter((_, pairIndex) => pairIndex !== index);
        const nextRightOrder = rightOrder
            .filter((pairIndex) => pairIndex !== index)
            .map((pairIndex) => (pairIndex > index ? pairIndex - 1 : pairIndex));
        setPairs(nextPairs);
        setRightOrder(nextRightOrder);
        emit(prompt, nextPairs, nextRightOrder);
    }

    function handleMoveRight(index: number, direction: -1 | 1) {
        const nextRightOrder = move(rightOrder, index, direction);
        setRightOrder(nextRightOrder);
        emit(prompt, pairs, nextRightOrder);
    }

    return (
        <div
            data-testid="match-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    required
                    data-testid="match-prompt"
                    placeholder="Match each country to its capital city:"
                    style={{ width: '100%', maxWidth: 680 }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Correct pairs</div>
                {pairs.map((pair, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(140px, 1fr) minmax(140px, 1fr) auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <input
                            type="text"
                            value={pair.left}
                            onChange={(e) => handlePairChange(index, 'left', e.target.value)}
                            required
                            data-testid={`match-left-${index}`}
                            placeholder="Left item"
                            style={{ width: '100%' }}
                        />
                        <input
                            type="text"
                            value={pair.right}
                            onChange={(e) => handlePairChange(index, 'right', e.target.value)}
                            required
                            data-testid={`match-right-${index}`}
                            placeholder="Matching right item"
                            style={{ width: '100%' }}
                        />
                        {pairs.length > MIN_PAIRS && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleRemovePair(index)}
                                style={{ padding: '2px 8px', fontSize: '0.85em' }}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    className="action-btn"
                    onClick={handleAddPair}
                    style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
                >
                    + Add pair
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                    Displayed right column order
                </div>
                {rightOrder.map((pairIndex, orderIndex) => (
                    <div
                        key={`${pairIndex}-${orderIndex}`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(160px, 1fr) auto auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <span className="muted" style={{ textAlign: 'center' }}>
                            {orderIndex}
                        </span>
                        <div>
                            <span className="gt">&gt;</span>{' '}
                            {pairs[pairIndex]?.right || `Right ${pairIndex + 1}`}
                        </div>
                        <button
                            type="button"
                            onClick={() => handleMoveRight(orderIndex, -1)}
                            disabled={orderIndex === 0}
                            data-testid={`match-right-up-${orderIndex}`}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                padding: '2px 8px',
                                color: 'var(--fg)',
                                opacity: orderIndex === 0 ? 0.3 : 1,
                            }}
                        >
                            Up
                        </button>
                        <button
                            type="button"
                            onClick={() => handleMoveRight(orderIndex, 1)}
                            disabled={orderIndex === rightOrder.length - 1}
                            data-testid={`match-right-down-${orderIndex}`}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                padding: '2px 8px',
                                color: 'var(--fg)',
                                opacity: orderIndex === rightOrder.length - 1 ? 0.3 : 1,
                            }}
                        >
                            Down
                        </button>
                    </div>
                ))}
            </div>

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Pairs define the correct matches. The right column order controls how the right side
                is displayed, and the answer is saved as right-item indices.
            </div>
        </div>
    );
}
