import type { Metadata } from 'next';
import PageShell from '@/components/ui/PageShell';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
    title: 'How to Play',
    description: 'How each Puzzle Pause puzzle type works.',
};

const PUZZLE_TYPES: { name: string; description: string }[] = [
    { name: 'Word', description: 'A word-based question or riddle. Type your answer.' },
    { name: 'Math', description: 'A math riddle or equation. Type the numeric answer.' },
    {
        name: 'Word Ladder (Classic)',
        description:
            'A chain of words where each step changes one letter from the last. Fill in the blanked-out words in the chain.',
    },
    {
        name: 'Word Ladder',
        description:
            'You are given a start word and an end word of the same length. Build your own chain of words, changing one letter at a time, until you reach the end word. Each guess is checked Wordle-style against the target.',
    },
    {
        name: 'Multiple Choice',
        description: 'A prompt with several options. Pick the correct one.',
    },
    {
        name: 'Word Search',
        description: 'Find the hidden word (or words) in a grid of letters.',
    },
    {
        name: 'Put in Order',
        description: 'Drag a list of items into the correct order.',
    },
    {
        name: 'Match Pairs',
        description: 'Match each item on the left with its correct partner on the right.',
    },
    {
        name: 'Connections',
        description:
            'Sort a grid of items into hidden groups that share something in common. Each group you reveal as a hint costs points.',
    },
    {
        name: 'Image Tap',
        description: 'Tap the correct spot on an image.',
    },
    {
        name: 'Image Order',
        description: 'Drag a set of images into the correct order.',
    },
    {
        name: 'Image Word',
        description: 'Type the word for what is shown in an image.',
    },
    {
        name: 'Number Grid',
        description: 'Work out the pattern in a grid of numbers and fill in the one that is missing.',
    },
    {
        name: 'Scrabble',
        description:
            'Given a rack of letters and a board with letter/word score multipliers, work out the highest-scoring word you can play and enter it with its score, e.g. "mask 10".',
    },
    {
        name: 'Word Wheel',
        description:
            'Letters are arranged around one or more wheels. Find the hidden word spelled out by letters on each wheel.',
    },
    {
        name: 'Countdown',
        description:
            'Use the given numbers and operators to reach the target number, like the Countdown numbers game.',
    },
    {
        name: 'Clue Reveal',
        description:
            'Guess who or what is being described. One clue is free; revealing extra clues costs points.',
    },
    {
        name: 'Chess',
        description: 'Find the correct move in the given chess position.',
    },
];

export default async function HowToPlayPage() {
    const user = await getUser();

    return (
        <PageShell isLoggedIn={!!user} title="How to Play">
            <main className="privacy-content">
                <h1>How to Play</h1>
                <p>
                    Every day there&apos;s a new puzzle, drawn from one of the types below. Solve
                    it as quickly as you can, with as few wrong guesses and hints as possible.
                </p>

                <h2>Scoring</h2>
                <p>
                    Solve within 10 minutes for 100 points, 15 minutes for 90, 30 minutes for 75,
                    or 60 minutes for 50. Each wrong guess costs 5 points, and each hint costs 10
                    points. Archived puzzles score the same way, with a further 10 point
                    deduction.
                </p>

                {PUZZLE_TYPES.map((type) => (
                    <div key={type.name}>
                        <h2>{type.name}</h2>
                        <p>{type.description}</p>
                    </div>
                ))}
            </main>
        </PageShell>
    );
}
