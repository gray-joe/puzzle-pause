'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

function buildQuestion(prompt: string, target: string, numbers: string, operators: string[]) {
    return JSON.stringify({
        prompt: prompt.trim() || 'Reach the target using the numbers and operators below:',
        target: Number(target),
        numbers: numbers
            .split(',')
            .map((n) => Number(n.trim()))
            .filter((n) => Number.isFinite(n)),
        operators,
    });
}

function parseQuestion(question: string) {
    try {
        const parsed = JSON.parse(question) as {
            prompt?: unknown;
            target?: unknown;
            numbers?: unknown;
            operators?: unknown;
        };
        if (!Array.isArray(parsed.numbers) || !Array.isArray(parsed.operators)) return null;
        return {
            prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
            target: String(parsed.target ?? ''),
            numbers: parsed.numbers.join(','),
            operators: parsed.operators.map(String),
        };
    } catch {
        return null;
    }
}

export default function CountdownBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('Reach the target using the numbers and operators below:');
    const [target, setTarget] = useState('306');
    const [numbers, setNumbers] = useState('75,50,6,3,2,1');
    const [operators, setOperators] = useState<string[]>(['+', '-', '×', '÷']);
    const [answerValue, setAnswerValue] = useState(answer);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);
        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt =
            parsed?.prompt || 'Reach the target using the numbers and operators below:';
        const nextTarget = parsed?.target || '306';
        const nextNumbers = parsed?.numbers || '75,50,6,3,2,1';
        const nextOperators = parsed?.operators ?? ['+', '-', '×', '÷'];
        const nextAnswer = answer || nextTarget;
        setPrompt(nextPrompt);
        setTarget(nextTarget);
        setNumbers(nextNumbers);
        setOperators(nextOperators);
        setAnswerValue(nextAnswer);
        onChange(buildQuestion(nextPrompt, nextTarget, nextNumbers, nextOperators), nextAnswer);
    }, [answer, initialised, onChange, question]);

    function emit(
        nextPrompt = prompt,
        nextTarget = target,
        nextNumbers = numbers,
        nextOperators = operators,
        nextAnswer = answerValue
    ) {
        onChange(buildQuestion(nextPrompt, nextTarget, nextNumbers, nextOperators), nextAnswer);
    }

    function toggleOperator(operator: string) {
        const next = operators.includes(operator)
            ? operators.filter((op) => op !== operator)
            : [...operators, operator];
        setOperators(next);
        emit(prompt, target, numbers, next, answerValue);
    }

    return (
        <div
            data-testid="countdown-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            <input
                data-testid="countdown-prompt"
                required
                value={prompt}
                onChange={(e) => {
                    setPrompt(e.target.value);
                    emit(e.target.value);
                }}
                placeholder="Prompt"
            />
            <input
                data-testid="countdown-target"
                required
                inputMode="numeric"
                value={target}
                onChange={(e) => {
                    setTarget(e.target.value);
                    emit(prompt, e.target.value);
                }}
                placeholder="Target"
            />
            <input
                data-testid="countdown-numbers"
                required
                value={numbers}
                onChange={(e) => {
                    setNumbers(e.target.value);
                    emit(prompt, target, e.target.value);
                }}
                placeholder="75,50,6,3,2,1"
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['+', '-', '×', '÷'].map((operator) => (
                    <label key={operator}>
                        <input
                            data-testid={`countdown-operator-${operator}`}
                            type="checkbox"
                            checked={operators.includes(operator)}
                            onChange={() => toggleOperator(operator)}
                        />{' '}
                        {operator}
                    </label>
                ))}
            </div>
            <input
                data-testid="countdown-answer"
                required
                inputMode="numeric"
                value={answerValue}
                onChange={(e) => {
                    setAnswerValue(e.target.value);
                    emit(prompt, target, numbers, operators, e.target.value);
                }}
                placeholder="306"
            />
        </div>
    );
}
