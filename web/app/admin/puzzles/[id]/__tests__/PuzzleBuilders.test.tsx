import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConnectionsBuilder from '../ConnectionsBuilder';
import CountdownBuilder from '../CountdownBuilder';

afterEach(cleanup);

describe('ConnectionsBuilder', () => {
    it('preserves shuffled item order when loading an existing puzzle', async () => {
        const onChange = vi.fn();
        const question = JSON.stringify({
            prompt: 'Find the groups:',
            items: ['APPLE', 'RED', 'BANANA', 'BLUE'],
            categories: ['Fruit', 'Colour'],
        });

        render(<ConnectionsBuilder question={question} answer="0,2|1,3" onChange={onChange} />);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const [nextQuestion, nextAnswer] = onChange.mock.calls.at(-1)!;

        expect(JSON.parse(nextQuestion).items).toEqual(['APPLE', 'RED', 'BANANA', 'BLUE']);
        expect(nextAnswer).toBe('0,2|1,3');
    });
});

describe('CountdownBuilder', () => {
    it('updates the accepted answer when the target changes', async () => {
        const onChange = vi.fn();
        const question = JSON.stringify({
            prompt: 'Reach the target:',
            target: 306,
            numbers: [75, 50, 6, 3, 2, 1],
            operators: ['+', '-'],
        });

        render(<CountdownBuilder question={question} answer="306" onChange={onChange} />);

        const target = screen.getByTestId('countdown-target');
        fireEvent.change(target, { target: { value: '100.0' } });

        await waitFor(() => {
            const [nextQuestion, nextAnswer] = onChange.mock.calls.at(-1)!;
            expect(JSON.parse(nextQuestion).target).toBe(100);
            expect(nextAnswer).toBe('100');
        });
        expect(screen.getByTestId('countdown-answer')).toHaveValue('100');
    });
});
