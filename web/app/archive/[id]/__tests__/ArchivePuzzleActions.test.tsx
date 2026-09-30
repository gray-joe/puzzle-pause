import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ArchivePuzzleActions from '../ArchivePuzzleActions';
import { Puzzle } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api')>();
    return {
        ...actual,
        api: {
            ...actual.api,
            archive: {
                attempt: vi.fn(),
                hint: vi.fn(),
                giveUp: vi.fn(),
            },
        },
    };
});

afterEach(cleanup);

function connectionsPuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
    return {
        id: 1,
        puzzle_date: '2026-01-01',
        puzzle_type: 'connections',
        puzzle_name: 'Test',
        question: JSON.stringify({
            prompt: 'Group these:',
            items: ['Cobra', 'Mamba', 'Java', 'Ruby'],
        }),
        hint: null,
        has_hint: true,
        total_hints: 2,
        puzzle_number: 1,
        ...overrides,
    };
}

describe('ArchivePuzzleActions', () => {
    // Regression test: navigating from one archived connections puzzle to
    // another (e.g. via "open another puzzle") re-uses the same component
    // tree with a new `puzzle` prop. Without remounting, ConnectionsPuzzle's
    // `groups` state stays sized for the old puzzle's category count, so
    // `groups[i]` goes out of bounds when a puzzle with more categories
    // renders more group buttons than `groups` has entries for.
    it('does not crash when switching to a different connections puzzle with more categories', () => {
        const { rerender } = render(
            <ArchivePuzzleActions
                puzzle={connectionsPuzzle({ id: 1, total_hints: 2 })}
                isLoggedIn={false}
            />
        );
        expect(screen.getByText('Group 1 (0)')).toBeInTheDocument();

        expect(() =>
            rerender(
                <ArchivePuzzleActions
                    puzzle={connectionsPuzzle({
                        id: 2,
                        total_hints: 4,
                        question: JSON.stringify({
                            prompt: 'Group these:',
                            items: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
                        }),
                    })}
                    isLoggedIn={false}
                />
            )
        ).not.toThrow();

        expect(screen.getByText('Group 4 (0)')).toBeInTheDocument();
    });
});
