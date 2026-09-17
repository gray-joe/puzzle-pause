import { describe, it, expect } from 'vitest';
import {
    buildChessQuestion,
    getMateInOneMoves,
    movePieceOnBoard,
    parseChessQuestion,
    setSquarePiece,
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

    it('builds a position one piece at a time from an empty board', () => {
        let fen = '8/8/8/8/8/8/8/8 w - - 0 1';
        fen = setSquarePiece(fen, 'f6', { type: 'k', color: 'w', label: '♔' });
        fen = setSquarePiece(fen, 'g6', { type: 'q', color: 'w', label: '♕' });
        fen = setSquarePiece(fen, 'h8', { type: 'k', color: 'b', label: '♚' });

        expect(getMateInOneMoves(fen)).toEqual(['Qg7#']);
    });

    it('moves a piece on the board', () => {
        expect(movePieceOnBoard(SCHOLAR_FEN, 'h5', 'f7')).toContain('Q');
    });

    it('returns null for a drop back on the same square instead of throwing', () => {
        expect(movePieceOnBoard(SCHOLAR_FEN, 'f8', 'f8')).toBeNull();
    });

    it('returns null for an illegal move instead of throwing', () => {
        expect(movePieceOnBoard(SCHOLAR_FEN, 'a1', 'a8')).toBeNull();
    });

    it('returns null for an invalid fen instead of throwing', () => {
        // king erased via the "skip validation" path used while editing
        expect(movePieceOnBoard('8/8/8/8/8/8/8/k7 b - - 0 1', 'a1', 'a2')).toBeNull();
    });
});
