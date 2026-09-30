import { describe, expect, it } from 'vitest';
import { buildCrossword } from '../crossword';

describe('buildCrossword', () => {
    it('numbers word starts and collects word cells', () => {
        // CAT / A#O / BOW
        const { cols, numbers, words } = buildCrossword(['...', '.#.', '...']);
        expect(cols).toBe(3);
        expect(numbers).toEqual(['1', null, '2', null, null, null, '3', null, null]);
        expect(words).toEqual([
            { number: '1', direction: 'across', cells: [0, 1, 2] },
            { number: '1', direction: 'down', cells: [0, 3, 6] },
            { number: '2', direction: 'down', cells: [2, 5, 8] },
            { number: '3', direction: 'across', cells: [6, 7, 8] },
        ]);
    });
});
