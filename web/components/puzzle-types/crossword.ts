export type Direction = 'across' | 'down';

export interface CrosswordData {
    prompt: string;
    layout: string[];
    clues: Record<Direction, Record<string, string>>;
}

export interface CrosswordWord {
    number: string;
    direction: Direction;
    cells: number[];
}

/** Standard numbering: a white cell is numbered if it starts an across or down word of 2+ letters.
 * Mirrors crossword_numbers in backend/app/puzzle_validation.py. */
export function buildCrossword(layout: string[]) {
    const rows = layout.length;
    const cols = layout[0]?.length ?? 0;
    const white = (r: number, c: number) =>
        r >= 0 && r < rows && c >= 0 && c < cols && layout[r][c] === '.';
    const numbers: (string | null)[] = new Array(rows * cols).fill(null);
    const words: CrosswordWord[] = [];
    let n = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!white(r, c)) continue;
            const startsAcross = !white(r, c - 1) && white(r, c + 1);
            const startsDown = !white(r - 1, c) && white(r + 1, c);
            if (!startsAcross && !startsDown) continue;
            const number = String(++n);
            numbers[r * cols + c] = number;
            if (startsAcross) {
                const cells = [];
                for (let cc = c; white(r, cc); cc++) cells.push(r * cols + cc);
                words.push({ number, direction: 'across', cells });
            }
            if (startsDown) {
                const cells = [];
                for (let rr = r; white(rr, c); rr++) cells.push(rr * cols + c);
                words.push({ number, direction: 'down', cells });
            }
        }
    }

    return { rows, cols, numbers, words };
}
