import { describe, it, expect } from 'vitest';
import {
    buildChessQuestion,
    getMateInOneMoves,
    parseChessQuestion,
    sideToMoveLabel,
} from '../chessHelpers';

const SCHOLAR_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

describe('chessHelpers', () => {
    it('parses chess question JSON', () => {
        const question = buildChessQuestion(SCHOLAR_FEN);
        expect(parseChessQuestion(question)).toEqual({ fen: SCHOLAR_FEN });
    });

    it('derives side to move labels', () => {
        expect(sideToMoveLabel(SCHOLAR_FEN)).toBe('White');
        expect(sideToMoveLabel('8/8/8/8/8/8/5k2/4q2K b - - 0 1')).toBe('Black');
    });

    it('finds mate-in-1 moves', () => {
        expect(getMateInOneMoves(SCHOLAR_FEN)).toContain('Qxf7#');
    });
});
