import { api } from '@/lib/api';
import { ogCard, ogSize } from '@/lib/ogCard';

export const alt = 'Puzzle Pause archive puzzle';
export const size = ogSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const puzzle = await api.archive.get(Number(id));
        return ogCard(
            `#${puzzle.puzzle_number ?? puzzle.id}. ${puzzle.puzzle_name || puzzle.puzzle_type}`,
            'Can you solve it?'
        );
    } catch {
        return ogCard('Puzzle archive', 'Daily word and logic puzzles');
    }
}
