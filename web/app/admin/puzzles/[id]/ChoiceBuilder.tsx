'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

const LETTERS = 'ABCDEFGHIJ';
const MIN_OPTIONS = 2;
const MAX_OPTIONS = LETTERS.length;

function parseQuestion(question: string) {
    const parts = question.split('|');
    return {
        prompt: parts[0] ?? '',
        options: parts.slice(1),
    };
}

function buildQuestion(prompt: string, options: string[]) {
    return [prompt.trim(), ...options.map((option) => option.trim())].join('|');
}

function answerToIndex(answer: string, optionCount: number) {
    const index = LETTERS.indexOf(answer.trim().toUpperCase());
    if (index < 0 || index >= optionCount) return 0;
    return index;
}

function normaliseText(value: string) {
    return value.replace(/\|/g, '').trimStart();
}

export default function ChoiceBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = question ? parseQuestion(question) : { prompt: '', options: [] };
        const nextOptions = [...parsed.options];
        while (nextOptions.length < MIN_OPTIONS) nextOptions.push('');
        const safeOptions = nextOptions.slice(0, MAX_OPTIONS);
        const nextCorrectIndex = answerToIndex(answer, safeOptions.length);

        setPrompt(parsed.prompt);
        setOptions(safeOptions);
        setCorrectIndex(nextCorrectIndex);
        onChange(buildQuestion(parsed.prompt, safeOptions), LETTERS[nextCorrectIndex]);
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextOptions: string[], nextCorrectIndex: number) {
        onChange(buildQuestion(nextPrompt, nextOptions), LETTERS[nextCorrectIndex]);
    }

    function handlePromptChange(value: string) {
        const nextPrompt = normaliseText(value);
        setPrompt(nextPrompt);
        emit(nextPrompt, options, correctIndex);
    }

    function handleOptionChange(index: number, value: string) {
        const nextOptions = options.map((option, optionIndex) =>
            optionIndex === index ? normaliseText(value) : option
        );
        setOptions(nextOptions);
        emit(prompt, nextOptions, correctIndex);
    }

    function handleCorrectChange(index: number) {
        setCorrectIndex(index);
        emit(prompt, options, index);
    }

    function handleAddOption() {
        if (options.length >= MAX_OPTIONS) return;
        const nextOptions = [...options, ''];
        setOptions(nextOptions);
        emit(prompt, nextOptions, correctIndex);
    }

    function handleRemoveOption(index: number) {
        if (options.length <= MIN_OPTIONS) return;
        const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
        const nextCorrectIndex =
            correctIndex === index ? 0 : correctIndex > index ? correctIndex - 1 : correctIndex;
        setOptions(nextOptions);
        setCorrectIndex(nextCorrectIndex);
        emit(prompt, nextOptions, nextCorrectIndex);
    }

    return (
        <div
            data-testid="choice-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    required
                    data-testid="choice-prompt"
                    placeholder="Which planet is largest?"
                    style={{ width: '100%', maxWidth: 680 }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {options.map((option, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(160px, 1fr) minmax(120px, auto) auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <span className="muted" style={{ textAlign: 'center' }}>
                            {LETTERS[index]}
                        </span>
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            required
                            data-testid={`choice-option-${index}`}
                            placeholder={`Option ${LETTERS[index]}`}
                            style={{ width: '100%' }}
                        />
                        <label
                            style={{
                                color: 'var(--muted)',
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                            }}
                        >
                            <input
                                type="radio"
                                name="choice-correct-option"
                                checked={correctIndex === index}
                                onChange={() => handleCorrectChange(index)}
                                data-testid={`choice-correct-${index}`}
                            />
                            Correct
                        </label>
                        {options.length > MIN_OPTIONS && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleRemoveOption(index)}
                                style={{ padding: '2px 8px', fontSize: '0.85em' }}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                type="button"
                className="action-btn"
                onClick={handleAddOption}
                disabled={options.length >= MAX_OPTIONS}
                style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
            >
                + Add option
            </button>

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Saved as prompt|option A|option B, with the selected option saved as a letter
                answer.
            </div>
        </div>
    );
}
