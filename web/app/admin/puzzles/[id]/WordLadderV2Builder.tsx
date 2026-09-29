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
    const [savedRoute] = useState(answer);

    useEffect(() => {
        // The server replaces the answer with the computed shortest route on save.
        onChange(`${start}, ${end}`, '');
    }, [end, onChange, start]);

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
            {savedRoute && (
                <div data-testid="ladder-v2-saved-route">Saved shortest route: {savedRoute}</div>
            )}
            <div className="muted" style={{ fontSize: '0.9em' }}>
                The shortest route is calculated when you save. Players may submit any valid
                dictionary path.
            </div>
        </div>
    );
}
