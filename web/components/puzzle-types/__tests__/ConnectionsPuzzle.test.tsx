import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectionsPuzzle from '../ConnectionsPuzzle';
import { Puzzle } from '@/lib/api';

afterEach(cleanup);

const QUESTION = JSON.stringify({
    prompt: 'Group these:',
    items: ['Cobra', 'Mamba', 'Java', 'Ruby'],
    categories: ['Snakes', 'Languages'],
});

// The API strips `categories` from the question until the puzzle is solved
// (backend/app/routers/puzzle.py `_strip_sensitive`); `total_hints` is the
// only reliable category count at that point.
const STRIPPED_QUESTION = JSON.stringify({
    prompt: 'Group these:',
    items: ['Cobra', 'Mamba', 'Java', 'Ruby'],
});

function makePuzzle(question = QUESTION, totalHints = 2): Puzzle {
    return {
        id: 1,
        puzzle_date: '2026-01-01',
        puzzle_type: 'connections',
        puzzle_name: 'Test Connections',
        question,
        hint: null,
        has_hint: true,
        total_hints: totalHints,
        puzzle_number: 1,
    };
}

describe('group labels', () => {
    it('shows generic labels when no hint revealed', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.getByText(/Group 1/)).toBeInTheDocument();
        expect(screen.getByText(/Group 2/)).toBeInTheDocument();
        expect(screen.queryByText(/Snakes/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Languages/)).not.toBeInTheDocument();
    });

    it('reveals first category label when hintsRevealed=1', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint="Snakes|Languages"
                hintsRevealed={1}
            />
        );
        expect(screen.getByText(/Snakes/)).toBeInTheDocument();
        expect(screen.queryByText(/Languages/)).not.toBeInTheDocument();
        expect(screen.getByText(/Group 2/)).toBeInTheDocument();
    });

    it('reveals all category labels when hintsRevealed equals group count', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint="Snakes|Languages"
                hintsRevealed={2}
            />
        );
        expect(screen.getByText(/Snakes/)).toBeInTheDocument();
        expect(screen.getByText(/Languages/)).toBeInTheDocument();
        expect(screen.queryByText(/Group 1/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Group 2/)).not.toBeInTheDocument();
    });
});

describe('group count from total_hints (categories stripped before solve)', () => {
    it('renders exactly 2 groups for a 2-category puzzle, not the old hardcoded 3', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle(STRIPPED_QUESTION, 2)}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.getByText(/Group 1/)).toBeInTheDocument();
        expect(screen.getByText(/Group 2/)).toBeInTheDocument();
        expect(screen.queryByText(/Group 3/)).not.toBeInTheDocument();
    });

    it('renders exactly 5 groups for a 5-category puzzle', () => {
        const question = JSON.stringify({
            prompt: 'Group these:',
            items: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        });
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle(question, 5)}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        for (let i = 1; i <= 5; i++) {
            expect(screen.getByText(new RegExp(`Group ${i}\\b`))).toBeInTheDocument();
        }
        expect(screen.queryByText(/Group 6/)).not.toBeInTheDocument();
    });

    it('submits the correct number of pipe-separated groups for a 2-category puzzle', async () => {
        const onSubmit = vi.fn();
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle(STRIPPED_QUESTION, 2)}
                solved={false}
                onSubmit={onSubmit}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );

        await userEvent.click(screen.getByText(/Group 1/));
        await userEvent.click(screen.getByText('Cobra'));
        await userEvent.click(screen.getByText('Mamba'));

        await userEvent.click(screen.getByText(/Group 2/));
        await userEvent.click(screen.getByText('Java'));
        await userEvent.click(screen.getByText('Ruby'));

        await userEvent.click(screen.getByTestId('submit-btn'));

        expect(onSubmit).toHaveBeenCalledWith('0,1|2,3');
    });
});

describe('items', () => {
    it('renders all items from question JSON', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.getByText('Cobra')).toBeInTheDocument();
        expect(screen.getByText('Mamba')).toBeInTheDocument();
        expect(screen.getByText('Java')).toBeInTheDocument();
        expect(screen.getByText('Ruby')).toBeInTheDocument();
    });

    it('submit button is disabled until all items are assigned', async () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });
});

describe('submission', () => {
    it('calls onSubmit with pipe-separated index groups', async () => {
        const onSubmit = vi.fn();
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={onSubmit}
                loading={false}
                hint="Snakes|Languages"
                hintsRevealed={2}
            />
        );

        // Select group 1 (Snakes), assign Cobra (idx 0) and Mamba (idx 1)
        await userEvent.click(screen.getByText(/Snakes/));
        await userEvent.click(screen.getByText('Cobra'));
        await userEvent.click(screen.getByText('Mamba'));

        // Select group 2 (Languages), assign Java (idx 2) and Ruby (idx 3)
        await userEvent.click(screen.getByText(/Languages/));
        await userEvent.click(screen.getByText('Java'));
        await userEvent.click(screen.getByText('Ruby'));

        await userEvent.click(screen.getByTestId('submit-btn'));

        expect(onSubmit).toHaveBeenCalledWith('0,1|2,3');
    });

    it('submit button is disabled while loading', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={false}
                onSubmit={() => {}}
                loading={true}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });

    it('hides submit button when solved', () => {
        render(
            <ConnectionsPuzzle
                puzzle={makePuzzle()}
                solved={true}
                onSubmit={() => {}}
                loading={false}
                hint={null}
                hintsRevealed={0}
            />
        );
        expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
    });
});
