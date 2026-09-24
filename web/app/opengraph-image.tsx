import { ogCard, ogSize } from '@/lib/ogCard';

export const alt = 'Puzzle Pause';
export const size = ogSize;
export const contentType = 'image/png';

export default function Image() {
    return ogCard("Today's puzzle is live", 'Daily word and logic puzzles');
}
