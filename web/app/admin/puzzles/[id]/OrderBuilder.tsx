'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type OrderQuestion = {
    prompt: string;
    items: string[];
};

const MIN_ITEMS = 2;

function parseQuestion(question: string): OrderQuestion | null {
    try {
        const parsed = JSON.parse(question) as { prompt?: unknown; items?: unknown };
        if (typeof parsed.prompt !== 'string' || !Array.isArray(parsed.items)) return null;

        const items = parsed.items.map((item) => String(item ?? ''));
        if (items.length < MIN_ITEMS) return null;
        return { prompt: parsed.prompt, items };
    } catch {
        return null;
    }
}

function parseAnswer(answer: string, itemCount: number) {
    const indices = answer
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((index) => Number.isInteger(index));
    const valid = indices.length === itemCount && new Set(indices).size === itemCount;
    if (valid && indices.every((index) => index >= 0 && index < itemCount)) return indices;
    return Array.from({ length: itemCount }, (_, index) => index);
}

function buildQuestion(prompt: string, items: string[]) {
    return JSON.stringify({
        prompt: prompt.trim() || 'Put these in order:',
        items: items.map((item) => item.trim()),
    });
}

function buildAnswer(correctOrder: number[]) {
    return correctOrder.join(',');
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    return next;
}

export default function OrderBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('Put these in order:');
    const [items, setItems] = useState<string[]>(['Item A', 'Item B']);
    const [correctOrder, setCorrectOrder] = useState<number[]>([0, 1]);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt = parsed?.prompt ?? 'Put these in order:';
        const nextItems = parsed?.items ?? ['Item A', 'Item B'];
        const nextCorrectOrder = parseAnswer(answer, nextItems.length);

        setPrompt(nextPrompt);
        setItems(nextItems);
        setCorrectOrder(nextCorrectOrder);
        onChange(buildQuestion(nextPrompt, nextItems), buildAnswer(nextCorrectOrder));
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextItems: string[], nextCorrectOrder: number[]) {
        onChange(buildQuestion(nextPrompt, nextItems), buildAnswer(nextCorrectOrder));
    }

    function handlePromptChange(value: string) {
        setPrompt(value);
        emit(value, items, correctOrder);
    }

    function handleItemChange(index: number, value: string) {
        const nextItems = items.map((item, itemIndex) => (itemIndex === index ? value : item));
        setItems(nextItems);
        emit(prompt, nextItems, correctOrder);
    }

    function handleAddItem() {
        const nextItems = [...items, `Item ${items.length + 1}`];
        const nextCorrectOrder = [...correctOrder, nextItems.length - 1];
        setItems(nextItems);
        setCorrectOrder(nextCorrectOrder);
        emit(prompt, nextItems, nextCorrectOrder);
    }

    function handleRemoveItem(index: number) {
        if (items.length <= MIN_ITEMS) return;
        const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
        const nextCorrectOrder = correctOrder
            .filter((itemIndex) => itemIndex !== index)
            .map((itemIndex) => (itemIndex > index ? itemIndex - 1 : itemIndex));
        setItems(nextItems);
        setCorrectOrder(nextCorrectOrder);
        emit(prompt, nextItems, nextCorrectOrder);
    }

    function handleMoveCorrect(index: number, direction: -1 | 1) {
        const nextCorrectOrder = move(correctOrder, index, direction);
        setCorrectOrder(nextCorrectOrder);
        emit(prompt, items, nextCorrectOrder);
    }

    return (
        <div
            data-testid="order-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    required
                    data-testid="order-prompt"
                    placeholder="Put these planets in order from the Sun:"
                    style={{ width: '100%', maxWidth: 680 }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Displayed items</div>
                {items.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(160px, 1fr) auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <span className="muted" style={{ textAlign: 'center' }}>
                            {index}
                        </span>
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => handleItemChange(index, e.target.value)}
                            required
                            data-testid={`order-item-${index}`}
                            placeholder={`Item ${index + 1}`}
                            style={{ width: '100%' }}
                        />
                        {items.length > MIN_ITEMS && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleRemoveItem(index)}
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
                    onClick={handleAddItem}
                    style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
                >
                    + Add item
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Correct order</div>
                {correctOrder.map((itemIndex, orderIndex) => (
                    <div
                        key={`${itemIndex}-${orderIndex}`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(160px, 1fr) auto auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <span className="muted" style={{ textAlign: 'center' }}>
                            {orderIndex + 1}
                        </span>
                        <div>
                            <span className="gt">&gt;</span>{' '}
                            {items[itemIndex] || `Item ${itemIndex + 1}`}
                        </div>
                        <button
                            type="button"
                            onClick={() => handleMoveCorrect(orderIndex, -1)}
                            disabled={orderIndex === 0}
                            data-testid={`order-correct-up-${orderIndex}`}
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
                            onClick={() => handleMoveCorrect(orderIndex, 1)}
                            disabled={orderIndex === correctOrder.length - 1}
                            data-testid={`order-correct-down-${orderIndex}`}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                padding: '2px 8px',
                                color: 'var(--fg)',
                                opacity: orderIndex === correctOrder.length - 1 ? 0.3 : 1,
                            }}
                        >
                            Down
                        </button>
                    </div>
                ))}
            </div>

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Displayed items are saved in the puzzle JSON. Correct order is saved as item
                indices, for example 1,2,0.
            </div>
        </div>
    );
}
