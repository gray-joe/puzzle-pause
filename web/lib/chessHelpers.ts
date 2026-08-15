import { Chess, Color, PieceSymbol, Square } from 'chess.js';

export interface ChessQuestion {
    fen: string;
}

export function parseChessQuestion(question: string): ChessQuestion | null {
    try {
        const data = JSON.parse(question) as ChessQuestion;
        if (!data?.fen || typeof data.fen !== 'string') return null;
        return data;
    } catch {
        return null;
    }
}

export function sideToMoveLabel(fen: string): string {
    const chess = new Chess(fen);
    return chess.turn() === 'w' ? 'White' : 'Black';
}

export function getMateInOneMoves(fen: string): string[] {
    const chess = new Chess(fen);
    const mates: string[] = [];

    for (const move of chess.moves({ verbose: true })) {
        chess.move(move.san);
        if (chess.isCheckmate()) {
            mates.push(move.san);
        }
        chess.undo();
    }

    return mates;
}

export function buildChessQuestion(fen: string): string {
    return JSON.stringify({ fen });
}

export interface PalettePiece {
    color: Color;
    type: PieceSymbol;
    label: string;
}

export const PIECE_PALETTE: PalettePiece[] = [
    { color: 'w', type: 'k', label: '♔' },
    { color: 'w', type: 'q', label: '♕' },
    { color: 'w', type: 'r', label: '♖' },
    { color: 'w', type: 'b', label: '♗' },
    { color: 'w', type: 'n', label: '♘' },
    { color: 'w', type: 'p', label: '♙' },
    { color: 'b', type: 'k', label: '♚' },
    { color: 'b', type: 'q', label: '♛' },
    { color: 'b', type: 'r', label: '♜' },
    { color: 'b', type: 'b', label: '♝' },
    { color: 'b', type: 'n', label: '♞' },
    { color: 'b', type: 'p', label: '♟' },
];

export function setSquarePiece(fen: string, square: Square, piece: PalettePiece | null): string {
    const chess = new Chess(fen);
    chess.remove(square);
    if (piece) {
        chess.put({ type: piece.type, color: piece.color }, square);
    }
    return chess.fen();
}

export function movePieceOnBoard(
    fen: string,
    sourceSquare: Square,
    targetSquare: Square
): string | null {
    const chess = new Chess(fen);
    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    return move ? chess.fen() : null;
}

export function setSideToMove(fen: string, color: Color): string {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) return fen;
    parts[1] = color;
    return parts.join(' ');
}

export function isValidChessFen(fen: string): boolean {
    try {
        new Chess(fen);
        return true;
    } catch {
        return false;
    }
}
