'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

function splitWords(value: string) {
    return value
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean);
}

export default function WordLadderV2Builder({ question, answer, onChange }: Props) {
    const initialEndpoints = splitWords(question);
    const [start, setStart] = useState(initialEndpoints[0] ?? 'cold');
    const [end, setEnd] = useState(initialEndpoints[1] ?? 'warm');
    const [words, setWords] = useState(() => {
        const initialWords = splitWords(answer);
        return initialWords.length ? initialWords : ['cord'];
    });

    useEffect(() => {
        onChange(`${start}, ${end}`, words.join(', '));
    }, [end, onChange, start, words]);

    function setWord(index: number, value: string) {
        setWords((current) =>
            current.map((word, wordIndex) => (wordIndex === index ? value.replace(/,/g, '') : word))
        );
    }

    return (
        <div
            data-testid="word-ladder-v2-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
            <label>
                Start word
                <input
                    value={start}
                    onChange={(event) => setStart(event.target.value.replace(/,/g, ''))}
                    required
                    data-testid="ladder-v2-start"
                    style={{ width: '100%' }}
                />
            </label>
            {words.map((word, index) => (
                <div key={index} style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={word}
                        onChange={(event) => setWord(index, event.target.value)}
                        required
                        aria-label={`Reference word ${index + 1}`}
                        data-testid="ladder-v2-reference-word"
                        style={{ flex: 1 }}
                    />
                    <button
                        type="button"
                        className="action-btn"
                        onClick={() =>
                            setWords((current) => [
                                ...current.slice(0, index + 1),
                                '',
                                ...current.slice(index + 1),
                            ])
                        }
                        style={{ width: 'auto', padding: '4px 10px' }}
                    >
                        Add after
                    </button>
                    {words.length > 1 && (
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() =>
                                setWords((current) =>
                                    current.filter((_, wordIndex) => wordIndex !== index)
                                )
                            }
                            style={{ width: 'auto', padding: '4px 10px' }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            ))}
            <label>
                End word
                <input
                    value={end}
                    onChange={(event) => setEnd(event.target.value.replace(/,/g, ''))}
                    required
                    data-testid="ladder-v2-end"
                    style={{ width: '100%' }}
                />
            </label>
            <div className="muted" style={{ fontSize: '0.9em' }}>
                The reference path controls green letter feedback. Players may submit any valid
                dictionary path.
            </div>
        </div>
    );
}
