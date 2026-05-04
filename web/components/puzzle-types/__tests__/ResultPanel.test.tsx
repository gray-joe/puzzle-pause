import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ResultPanel from '../ResultPanel';
import { Puzzle, AttemptDetail } from '@/lib/api';

afterEach(cleanup);

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
    return {
        id: 1,
        puzzle_date: '2026-01-01',
        puzzle_type: 'word',
        puzzle_name: 'Test',
        question: 'What is the word?',
        hint: null,
        has_hint: false,
        puzzle_number: 1,
        ...overrides,
    };
}

function makeAttempt(overrides: Partial<AttemptDetail> = {}): AttemptDetail {
    return {
        solved: true,
        score: 100,
        incorrect_guesses: 0,
        hint_used: 0,
        completed_at: '2026-01-01T10:05:00Z',
        opened_at: '2026-01-01T10:00:00Z',
        ...overrides,
    };
}

describe('connections result display', () => {
    const connectionsPuzzle = makePuzzle({
        puzzle_type: 'connections',
        question: JSON.stringify({
            prompt: 'Group these:',
            items: ['Cobra', 'Mamba', 'Java', 'Ruby'],
            categories: ['Snakes', 'Languages'],
        }),
    });

    it('shows category names and their items', () => {
        render(
            <ResultPanel
                puzzle={connectionsPuzzle}
                attempt={makeAttempt()}
                answer="0,1|2,3"
                isLoggedIn={false}
            />
        );
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Snakes');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Languages');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Cobra');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Mamba');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Java');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Ruby');
    });

    it("does not show the generic 'correct answer was' text", () => {
        render(
            <ResultPanel
                puzzle={connectionsPuzzle}
                attempt={makeAttempt()}
                answer="0,1|2,3"
                isLoggedIn={false}
            />
        );
        expect(screen.queryByText(/correct answer was/)).not.toBeInTheDocument();
    });

    it('falls back to Group N labels if categories missing from question', () => {
        const strippedPuzzle = makePuzzle({
            puzzle_type: 'connections',
            question: JSON.stringify({
                prompt: 'Group these:',
                items: ['Cobra', 'Mamba', 'Java', 'Ruby'],
            }),
        });
        render(
            <ResultPanel
                puzzle={strippedPuzzle}
                attempt={makeAttempt()}
                answer="0,1|2,3"
                isLoggedIn={false}
            />
        );
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Group 1');
        expect(screen.getByTestId('result-answer')).toHaveTextContent('Group 2');
    });
});

describe('hint penalty display', () => {
    it('shows 0 pts when no hints used', () => {
        render(
            <ResultPanel
                puzzle={makePuzzle()}
                attempt={makeAttempt({ hint_used: 0 })}
                answer="hello"
                isLoggedIn={true}
            />
        );
        expect(screen.getByText(/Hints:/)).toHaveTextContent('0 pts');
    });

    it('shows -10 for one hint', () => {
        render(
            <ResultPanel
                puzzle={makePuzzle()}
                attempt={makeAttempt({ hint_used: 1 })}
                answer="hello"
                isLoggedIn={true}
            />
        );
        expect(screen.getByText(/Hints:/)).toHaveTextContent('-10 pts');
    });

    it('shows -30 for three hints', () => {
        render(
            <ResultPanel
                puzzle={makePuzzle()}
                attempt={makeAttempt({ hint_used: 3 })}
                answer="hello"
                isLoggedIn={true}
            />
        );
        expect(screen.getByText(/Hints:/)).toHaveTextContent('-30 pts');
    });
});
