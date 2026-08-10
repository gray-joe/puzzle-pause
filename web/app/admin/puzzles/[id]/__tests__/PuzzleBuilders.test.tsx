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

    it('adds a new item to all groups when clicking add item button', async () => {
        const onChange = vi.fn();

        render(<ConnectionsBuilder question="" answer="" onChange={onChange} />);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        onChange.mockClear();

        const addItemButton = screen.getByTestId('connections-add-item');
        fireEvent.click(addItemButton);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const [nextQuestion] = onChange.mock.calls.at(-1)!;
        const parsed = JSON.parse(nextQuestion);

        expect(parsed.items).toHaveLength(6);
        expect(parsed.categories).toHaveLength(2);
    });

    it('removes an item from all groups when clicking remove item button', async () => {
        const onChange = vi.fn();

        render(<ConnectionsBuilder question="" answer="" onChange={onChange} />);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        onChange.mockClear();

        const addItemButton = screen.getByTestId('connections-add-item');
        fireEvent.click(addItemButton);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        onChange.mockClear();

        const removeItemButton = screen.getByTestId('connections-remove-item-0-2');
        fireEvent.click(removeItemButton);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const [nextQuestion] = onChange.mock.calls.at(-1)!;
        const parsed = JSON.parse(nextQuestion);

        expect(parsed.items).toHaveLength(4);
        expect(parsed.categories).toHaveLength(2);
    });

    it('does not show remove button when at minimum items per group', async () => {
        const onChange = vi.fn();

        render(<ConnectionsBuilder question="" answer="" onChange={onChange} />);

        await waitFor(() => expect(onChange).toHaveBeenCalled());

        expect(screen.queryByTestId('connections-remove-item-0-0')).not.toBeInTheDocument();
        expect(screen.queryByTestId('connections-remove-item-0-1')).not.toBeInTheDocument();
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
