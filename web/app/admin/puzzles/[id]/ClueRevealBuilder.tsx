'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

function buildQuestion(prompt: string, clues: string[]) {
    return JSON.stringify({
        prompt: prompt.trim() || 'Who am I?',
        clues: clues.map((clue) => clue.trim()),
    });
}

function parseQuestion(question: string) {
    try {
        const parsed = JSON.parse(question) as { prompt?: unknown; clues?: unknown };
        if (!Array.isArray(parsed.clues)) return null;
        return {
            prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
            clues: parsed.clues.map((clue) => String(clue ?? '')),
        };
    } catch {
        return null;
    }
}

export default function ClueRevealBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('Who am I?');
    const [clues, setClues] = useState(['First clue', 'Second clue']);
    const [answerValue, setAnswerValue] = useState(answer);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);
        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt = parsed?.prompt || 'Who am I?';
        const nextClues =
            parsed?.clues && parsed.clues.length >= 2
                ? parsed.clues
                : ['First clue', 'Second clue'];
        const nextAnswer = answer || '';
        setPrompt(nextPrompt);
        setClues(nextClues);
        setAnswerValue(nextAnswer);
        onChange(buildQuestion(nextPrompt, nextClues), nextAnswer);
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt = prompt, nextClues = clues, nextAnswer = answerValue) {
        onChange(buildQuestion(nextPrompt, nextClues), nextAnswer);
    }
    function setClue(index: number, value: string) {
        const next = clues.map((clue, clueIndex) => (clueIndex === index ? value : clue));
        setClues(next);
        emit(prompt, next);
    }
    function addClue() {
        const next = [...clues, ''];
        setClues(next);
        emit(prompt, next);
    }
    function removeClue(index: number) {
        if (clues.length <= 2) return;
        const next = clues.filter((_, clueIndex) => clueIndex !== index);
        setClues(next);
        emit(prompt, next);
    }

    return (
        <div
            data-testid="clue-reveal-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            <input
                data-testid="clue-reveal-prompt"
                required
                value={prompt}
                onChange={(e) => {
                    setPrompt(e.target.value);
                    emit(e.target.value);
                }}
                placeholder="Prompt"
            />
            {clues.map((clue, index) => (
                <div
                    key={index}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}
                >
                    <input
                        data-testid={`clue-reveal-clue-${index}`}
                        required
                        value={clue}
                        onChange={(e) => setClue(index, e.target.value)}
                        placeholder={`Clue ${index + 1}`}
                    />
                    {clues.length > 2 && (
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() => removeClue(index)}
                            style={{ padding: '2px 8px' }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            ))}
            <button
                type="button"
                className="action-btn"
                onClick={addClue}
                style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
            >
                + Add clue
            </button>
            <input
                data-testid="clue-reveal-answer"
                required
                value={answerValue}
                onChange={(e) => {
                    setAnswerValue(e.target.value);
                    emit(prompt, clues, e.target.value);
                }}
                placeholder="Answer"
            />
        </div>
    );
}
