'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type Step = {
    kind: 'word' | 'blank';
    value: string;
};

const DEFAULT_STEPS: Step[] = [
    { kind: 'word', value: 'Dawn' },
    { kind: 'blank', value: '' },
    { kind: 'word', value: 'Dare' },
    { kind: 'blank', value: '' },
    { kind: 'word', value: 'Dusk' },
];

function parseQuestion(question: string, answer: string): Step[] | null {
    const parts = question
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (parts.length === 0) return null;

    const answers = answer
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    let answerIndex = 0;

    return parts.map((part) => {
        if (part === '____') {
            const value = answers[answerIndex] ?? '';
            answerIndex += 1;
            return { kind: 'blank', value };
        }

        return { kind: 'word', value: part };
    });
}

function buildQuestion(steps: Step[]) {
    return steps.map((step) => (step.kind === 'blank' ? '____' : step.value.trim())).join(', ');
}

function buildAnswer(steps: Step[]) {
    return steps
        .filter((step) => step.kind === 'blank')
        .map((step) => step.value.trim())
        .join(', ');
}

function normaliseWord(value: string) {
    return value.replace(/,/g, '').trim();
}

export default function WordLadderBuilder({ question, answer, onChange }: Props) {
    const [steps, setSteps] = useState<Step[]>(() => DEFAULT_STEPS);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const nextSteps = question
            ? (parseQuestion(question, answer) ?? DEFAULT_STEPS)
            : DEFAULT_STEPS;
        setSteps(nextSteps);
        onChange(buildQuestion(nextSteps), buildAnswer(nextSteps));
    }, [answer, initialised, onChange, question]);

    function emit(nextSteps: Step[]) {
        onChange(buildQuestion(nextSteps), buildAnswer(nextSteps));
    }

    function handleStepValueChange(index: number, value: string) {
        const next = steps.map((step, stepIndex) =>
            stepIndex === index ? { ...step, value: normaliseWord(value) } : step
        );
        setSteps(next);
        emit(next);
    }

    function handleStepKindChange(index: number, kind: Step['kind']) {
        const next = steps.map((step, stepIndex) =>
            stepIndex === index
                ? { ...step, kind, value: kind === step.kind ? step.value : '' }
                : step
        );
        setSteps(next);
        emit(next);
    }

    function handleAddStep(index: number) {
        const next = [
            ...steps.slice(0, index + 1),
            { kind: 'blank' as const, value: '' },
            ...steps.slice(index + 1),
        ];
        setSteps(next);
        emit(next);
    }

    function handleRemoveStep(index: number) {
        const next = steps.filter((_, stepIndex) => stepIndex !== index);
        const safeSteps = next.length ? next : DEFAULT_STEPS;
        setSteps(safeSteps);
        emit(safeSteps);
    }

    return (
        <div
            data-testid="word-ladder-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            {steps.map((step, index) => (
                <div
                    key={index}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(90px, 120px) minmax(160px, 1fr) auto auto',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <select
                        value={step.kind}
                        onChange={(e) =>
                            handleStepKindChange(index, e.target.value as Step['kind'])
                        }
                        data-testid={`ladder-step-type-${index}`}
                        aria-label={`Step ${index + 1} type`}
                    >
                        <option value="word">Visible</option>
                        <option value="blank">Blank</option>
                    </select>
                    <input
                        type="text"
                        value={step.value}
                        onChange={(e) => handleStepValueChange(index, e.target.value)}
                        required
                        data-testid={`ladder-step-value-${index}`}
                        placeholder={step.kind === 'blank' ? 'Answer for blank' : 'Visible word'}
                        style={{ width: '100%' }}
                    />
                    <button
                        type="button"
                        className="action-btn"
                        onClick={() => handleAddStep(index)}
                        style={{ padding: '2px 8px', fontSize: '0.85em' }}
                    >
                        Add after
                    </button>
                    {steps.length > 1 && (
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleRemoveStep(index)}
                            style={{ padding: '2px 8px', fontSize: '0.85em' }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            ))}

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Blank rows are saved as ____ in the puzzle and their values are saved as the answer
                in order.
            </div>
        </div>
    );
}
