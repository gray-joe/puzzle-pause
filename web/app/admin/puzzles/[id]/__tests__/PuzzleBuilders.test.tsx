import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConnectionsBuilder from '../ConnectionsBuilder';
import CountdownBuilder from '../CountdownBuilder';
import ChoiceBuilder from '../ChoiceBuilder';
import CrosswordBuilder from '../CrosswordBuilder';

afterEach(cleanup);

describe('ChoiceBuilder', () => {
    it('renders the prompt as a multi-line textarea', () => {
        render(<ChoiceBuilder question="" answer="" onChange={vi.fn()} />);

        const prompt = screen.getByTestId('choice-prompt');
        expect(prompt.tagName).toBe('TEXTAREA');
    });

    it('preserves newlines typed into the prompt', async () => {
        const onChange = vi.fn();
        render(<ChoiceBuilder question="" answer="" onChange={onChange} />);

        const prompt = screen.getByTestId('choice-prompt');
        fireEvent.change(prompt, { target: { value: 'Line one\nLine two' } });

        await waitFor(() => {
            const [nextQuestion] = onChange.mock.calls.at(-1)!;
            expect(nextQuestion.startsWith('Line one\nLine two|')).toBe(true);
        });
    });

    it('loads an existing multi-line prompt from a saved question', () => {
        render(
            <ChoiceBuilder question={'Line one\nLine two|Red|Blue'} answer="A" onChange={vi.fn()} />
        );

        const prompt = screen.getByTestId('choice-prompt') as HTMLTextAreaElement;
        expect(prompt.value).toBe('Line one\nLine two');
    });
});

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

describe('CrosswordBuilder', () => {
    const layout = ['...', '.#.', '...'];

    it('keeps clues on their words when the grid renumbers', async () => {
        const onChange = vi.fn();
        const question = JSON.stringify({
            prompt: 'Mini',
            layout,
            clues: { across: { 1: 'Feline', 3: 'Ribbon knot' }, down: { 1: 'Taxi', 2: 'Tow' } },
        });
        render(<CrosswordBuilder question={question} answer="CATA#OBOW" onChange={onChange} />);

        fireEvent.change(screen.getByTestId('crossword-grid-input'), {
            target: { value: 'DOG\nCAT\nA#O\nBOW' },
        });

        await waitFor(() => {
            const saved = JSON.parse(onChange.mock.calls.at(-1)![0]);
            expect(saved.clues.across).toEqual({ 1: '', 4: 'Feline', 5: 'Ribbon knot' });
        });
    });

    it('loads a saved question with no clues without crashing', () => {
        render(
            <CrosswordBuilder
                question={JSON.stringify({ prompt: 'Mini', layout })}
                answer="CATA#OBOW"
                onChange={vi.fn()}
            />
        );

        expect((screen.getByTestId('crossword-clue-across-1') as HTMLInputElement).value).toBe('');
    });
});
