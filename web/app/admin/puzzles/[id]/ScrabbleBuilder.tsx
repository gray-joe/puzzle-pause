'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type Cell = string | null;
const MODIFIERS = ['', 'dl', 'tl', 'dw', 'tw'];

function defaultBoard(): Cell[] {
    return Array(7).fill(null);
}

function normaliseLetter(value: string) {
    return value
        .replace(/[^a-zA-Z]/g, '')
        .slice(-1)
        .toUpperCase();
}

function normaliseRack(value: string) {
    return value.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

function buildQuestion(prompt: string, board: Cell[], modifiers: Cell[], rack: string) {
    return JSON.stringify({
        prompt: prompt.trim() || 'What is the highest scoring word achievable?',
        board,
        modifiers,
        rack: normaliseRack(rack).split(''),
    });
}

function parseQuestion(question: string) {
    try {
        const parsed = JSON.parse(question) as {
            prompt?: unknown;
            board?: unknown;
            modifiers?: unknown;
            rack?: unknown;
        };
        if (
            !Array.isArray(parsed.board) ||
            !Array.isArray(parsed.modifiers) ||
            !Array.isArray(parsed.rack)
        )
            return null;
        return {
            prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
            board: parsed.board.map((cell) =>
                cell === null ? null : normaliseLetter(String(cell))
            ) as Cell[],
            modifiers: parsed.modifiers.map((cell) =>
                cell === null ? null : String(cell)
            ) as Cell[],
            rack: parsed.rack.map((letter) => normaliseLetter(String(letter))).join(''),
        };
    } catch {
        return null;
    }
}

export default function ScrabbleBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('What is the highest scoring word achievable?');
    const [board, setBoard] = useState<Cell[]>(() => defaultBoard());
    const [modifiers, setModifiers] = useState<Cell[]>(() => defaultBoard());
    const [rack, setRack] = useState('');
    const [answerValue, setAnswerValue] = useState(answer);
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);
        const parsed = question ? parseQuestion(question) : null;
        const nextPrompt = parsed?.prompt || 'What is the highest scoring word achievable?';
        const nextBoard = parsed?.board ?? defaultBoard();
        const nextModifiers = parsed?.modifiers ?? defaultBoard();
        const nextRack = parsed?.rack ?? '';
        const nextAnswer = answer || '';
        setPrompt(nextPrompt);
        setBoard(nextBoard);
        setModifiers(nextModifiers);
        setRack(nextRack);
        setAnswerValue(nextAnswer);
        onChange(buildQuestion(nextPrompt, nextBoard, nextModifiers, nextRack), nextAnswer);
    }, [answer, initialised, onChange, question]);

    function emit(
        nextPrompt: string,
        nextBoard: Cell[],
        nextModifiers: Cell[],
        nextRack: string,
        nextAnswer: string
    ) {
        onChange(buildQuestion(nextPrompt, nextBoard, nextModifiers, nextRack), nextAnswer);
    }

    function setCell(index: number, value: string) {
        const letter = normaliseLetter(value);
        const next = board.map((cell, cellIndex) => (cellIndex === index ? letter || null : cell));
        setBoard(next);
        emit(prompt, next, modifiers, rack, answerValue);
    }

    function setModifier(index: number, value: string) {
        const next = modifiers.map((cell, cellIndex) =>
            cellIndex === index ? value || null : cell
        );
        setModifiers(next);
        emit(prompt, board, next, rack, answerValue);
    }

    return (
        <div
            data-testid="scrabble-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
            <input
                data-testid="scrabble-prompt"
                required
                value={prompt}
                onChange={(e) => {
                    setPrompt(e.target.value);
                    emit(e.target.value, board, modifiers, rack, answerValue);
                }}
                placeholder="Prompt"
            />
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${board.length}, minmax(48px, 1fr))`,
                    gap: 6,
                }}
            >
                {board.map((cell, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                            data-testid={`scrabble-board-${index}`}
                            value={cell ?? ''}
                            onChange={(e) => setCell(index, e.target.value)}
                            placeholder="_"
                            style={{ textAlign: 'center' }}
                        />
                        <select
                            data-testid={`scrabble-modifier-${index}`}
                            value={modifiers[index] ?? ''}
                            onChange={(e) => setModifier(index, e.target.value)}
                        >
                            {MODIFIERS.map((modifier) => (
                                <option key={modifier || 'none'} value={modifier}>
                                    {modifier || '-'}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
            <input
                data-testid="scrabble-rack"
                required
                value={rack}
                onChange={(e) => {
                    const next = normaliseRack(e.target.value);
                    setRack(next);
                    emit(prompt, board, modifiers, next, answerValue);
                }}
                placeholder="Rack letters"
            />
            <input
                data-testid="scrabble-answer"
                required
                value={answerValue}
                onChange={(e) => {
                    setAnswerValue(e.target.value);
                    emit(prompt, board, modifiers, rack, e.target.value);
                }}
                placeholder="word score"
            />
        </div>
    );
}
