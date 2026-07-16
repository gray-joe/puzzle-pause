'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type Wheel = { letters: (string | null)[] };

const DEFAULT_WHEEL_SIZE = 8;

function defaultWheel(): Wheel {
    return {
        letters: Array.from({ length: DEFAULT_WHEEL_SIZE }, (_, index) =>
            index === 2 || index === 6 ? null : ''
        ),
    };
}

function buildQuestion(prompt: string, wheels: Wheel[]) {
    return JSON.stringify({
        prompt:
            prompt.trim() ||
            'Find the 8-letter word hidden in each wheel. Letters can be read clockwise or anticlockwise.',
        wheels: wheels.map((wheel) => ({
            letters: wheel.letters.map((letter) => (letter === null ? null : letter.toUpperCase())),
        })),
    });
}

function parseQuestion(question: string): { prompt: string; wheels: Wheel[] } | null {
    try {
        const parsed = JSON.parse(question) as { prompt?: unknown; wheels?: unknown };
        if (typeof parsed.prompt !== 'string' || !Array.isArray(parsed.wheels)) return null;

        const wheels = parsed.wheels
            .map((wheel) => {
                if (!wheel || typeof wheel !== 'object' || !('letters' in wheel)) return null;
                const letters = (wheel as { letters?: unknown }).letters;
                if (!Array.isArray(letters) || letters.length === 0) return null;

                return {
                    letters: letters.map((letter) =>
                        letter === null
                            ? null
                            : String(letter ?? '')
                                  .slice(0, 1)
                                  .toUpperCase()
                    ),
                };
            })
            .filter((wheel): wheel is Wheel => wheel !== null);

        if (wheels.length === 0) return null;
        return { prompt: parsed.prompt, wheels };
    } catch {
        return null;
    }
}

function parseAnswerWords(answer: string, wheelCount: number) {
    const words = answer.trim() ? answer.trim().split(/\s+/) : [];
    return Array.from({ length: wheelCount }, (_, index) => words[index]?.toUpperCase() ?? '');
}

function buildAnswer(answerWords: string[]) {
    return answerWords
        .map((word) => word.trim().toUpperCase())
        .join(' ')
        .trim();
}

function normaliseLetter(value: string) {
    return value
        .replace(/[^a-zA-Z]/g, '')
        .slice(-1)
        .toUpperCase();
}

function normaliseWord(value: string) {
    return value.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

export default function WordWheelBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState(
        'Find the 8-letter word hidden in each wheel. Letters can be read clockwise or anticlockwise.'
    );
    const [wheels, setWheels] = useState<Wheel[]>(() => [defaultWheel()]);
    const [answerWords, setAnswerWords] = useState<string[]>(['']);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt =
            parsed?.prompt ??
            'Find the 8-letter word hidden in each wheel. Letters can be read clockwise or anticlockwise.';
        const nextWheels = parsed?.wheels ?? [defaultWheel()];
        const nextAnswerWords = parsed ? parseAnswerWords(answer, nextWheels.length) : [''];

        setPrompt(nextPrompt);
        setWheels(nextWheels);
        setAnswerWords(nextAnswerWords);
        onChange(buildQuestion(nextPrompt, nextWheels), buildAnswer(nextAnswerWords));
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextWheels: Wheel[], nextAnswerWords: string[]) {
        onChange(buildQuestion(nextPrompt, nextWheels), buildAnswer(nextAnswerWords));
    }

    function handlePromptChange(value: string) {
        setPrompt(value);
        emit(value, wheels, answerWords);
    }

    function handleLetterChange(wheelIndex: number, letterIndex: number, value: string) {
        const letter = normaliseLetter(value);
        const next = wheels.map((wheel, currentWheelIndex) =>
            currentWheelIndex === wheelIndex
                ? {
                      letters: wheel.letters.map((currentLetter, currentLetterIndex) =>
                          currentLetterIndex === letterIndex ? letter : currentLetter
                      ),
                  }
                : wheel
        );
        setWheels(next);
        emit(prompt, next, answerWords);
    }

    function handleMissingToggle(wheelIndex: number, letterIndex: number) {
        const next = wheels.map((wheel, currentWheelIndex) =>
            currentWheelIndex === wheelIndex
                ? {
                      letters: wheel.letters.map((letter, currentLetterIndex) =>
                          currentLetterIndex === letterIndex
                              ? letter === null
                                  ? ''
                                  : null
                              : letter
                      ),
                  }
                : wheel
        );
        setWheels(next);
        emit(prompt, next, answerWords);
    }

    function handleAnswerChange(wheelIndex: number, value: string) {
        const next = answerWords.map((word, currentWheelIndex) =>
            currentWheelIndex === wheelIndex ? normaliseWord(value) : word
        );
        setAnswerWords(next);
        emit(prompt, wheels, next);
    }

    function handleAddWheel() {
        const nextWheels = [...wheels, defaultWheel()];
        const nextAnswerWords = [...answerWords, ''];
        setWheels(nextWheels);
        setAnswerWords(nextAnswerWords);
        emit(prompt, nextWheels, nextAnswerWords);
    }

    function handleRemoveWheel(wheelIndex: number) {
        const nextWheels = wheels.filter(
            (_, currentWheelIndex) => currentWheelIndex !== wheelIndex
        );
        const nextAnswerWords = answerWords.filter(
            (_, currentWheelIndex) => currentWheelIndex !== wheelIndex
        );
        const safeWheels = nextWheels.length ? nextWheels : [defaultWheel()];
        const safeAnswerWords = nextAnswerWords.length ? nextAnswerWords : [''];
        setWheels(safeWheels);
        setAnswerWords(safeAnswerWords);
        emit(prompt, safeWheels, safeAnswerWords);
    }

    return (
        <div
            data-testid="word-wheel-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    data-testid="word-wheel-prompt"
                    placeholder="Find the 8-letter word hidden in each wheel"
                    style={{ width: '100%', maxWidth: 680 }}
                />
            </div>

            {wheels.map((wheel, wheelIndex) => (
                <div
                    key={wheelIndex}
                    style={{
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'center',
                        }}
                    >
                        <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                            Wheel {wheelIndex + 1}
                        </div>
                        {wheels.length > 1 && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleRemoveWheel(wheelIndex)}
                                style={{ padding: '2px 8px', fontSize: '0.85em' }}
                            >
                                Remove wheel
                            </button>
                        )}
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(56px, 72px))',
                            gap: 8,
                            overflowX: 'auto',
                        }}
                    >
                        {wheel.letters.map((letter, letterIndex) => {
                            const isMissing = letter === null;
                            return (
                                <div
                                    key={letterIndex}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                                >
                                    <input
                                        type="text"
                                        value={isMissing ? '?' : letter}
                                        disabled={isMissing}
                                        required={!isMissing}
                                        data-testid={`word-wheel-letter-${wheelIndex}-${letterIndex}`}
                                        onChange={(e) =>
                                            handleLetterChange(
                                                wheelIndex,
                                                letterIndex,
                                                e.target.value
                                            )
                                        }
                                        style={{
                                            height: 44,
                                            textAlign: 'center',
                                            border: isMissing
                                                ? '1px solid var(--orange)'
                                                : '1px solid var(--border)',
                                            background: isMissing
                                                ? 'rgba(255,166,77,0.08)'
                                                : undefined,
                                            color: isMissing ? 'var(--orange)' : undefined,
                                            fontWeight: isMissing ? 700 : undefined,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="action-btn"
                                        onClick={() => handleMissingToggle(wheelIndex, letterIndex)}
                                        style={{ padding: '2px 4px', fontSize: '0.75em' }}
                                    >
                                        {isMissing ? 'Letter' : 'Missing'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                            Answer word <span style={{ opacity: 0.6 }}>(stored as answer)</span>
                        </label>
                        <input
                            type="text"
                            value={answerWords[wheelIndex] ?? ''}
                            onChange={(e) => handleAnswerChange(wheelIndex, e.target.value)}
                            required
                            data-testid={`word-wheel-answer-${wheelIndex}`}
                            placeholder="STARLING"
                            style={{ width: 180, letterSpacing: '0.08em' }}
                        />
                    </div>
                </div>
            ))}

            <button
                type="button"
                className="action-btn"
                onClick={handleAddWheel}
                style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
            >
                + Add wheel
            </button>
        </div>
    );
}
