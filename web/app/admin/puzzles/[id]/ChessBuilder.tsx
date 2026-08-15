'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chess, Square } from 'chess.js';
import ChessBoardView from '@/components/puzzle-types/ChessBoardView';
import {
    PIECE_PALETTE,
    PalettePiece,
    buildChessQuestion,
    getMateInOneMoves,
    isValidChessFen,
    movePieceOnBoard,
    parseChessQuestion,
    setSideToMove,
    setSquarePiece,
} from '@/lib/chessHelpers';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function ChessBuilder({ question, answer, onChange }: Props) {
    const [fen, setFen] = useState(STARTING_FEN);
    const [selectedPiece, setSelectedPiece] = useState<PalettePiece | 'erase' | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [initialised, setInitialised] = useState(false);

    const mateMoves = useMemo(() => (isValidChessFen(fen) ? getMateInOneMoves(fen) : []), [fen]);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = question ? parseChessQuestion(question) : null;
        const nextFen = parsed?.fen ?? STARTING_FEN;
        const nextAnswer = answer.trim();

        setFen(nextFen);
        setSelectedAnswer(nextAnswer);
        onChange(buildChessQuestion(nextFen), nextAnswer);
    }, [answer, initialised, onChange, question]);

    function emit(nextFen: string, nextAnswer: string) {
        const validMoves = getMateInOneMoves(nextFen);
        const preservedAnswer = validMoves.includes(nextAnswer) ? nextAnswer : '';
        setFen(nextFen);
        setSelectedAnswer(preservedAnswer);
        onChange(buildChessQuestion(nextFen), preservedAnswer);
    }

    function handleSquareClick({ square }: { piece: string | null; square: string }) {
        if (!selectedPiece) return;
        const nextFen =
            selectedPiece === 'erase'
                ? setSquarePiece(fen, square as Square, null)
                : setSquarePiece(fen, square as Square, selectedPiece);
        emit(nextFen, selectedAnswer);
    }

    function handlePieceDrop({
        sourceSquare,
        targetSquare,
    }: {
        piece: string;
        sourceSquare: string;
        targetSquare: string | null;
    }) {
        if (!targetSquare) return false;
        const nextFen = movePieceOnBoard(fen, sourceSquare as Square, targetSquare as Square);
        if (!nextFen) return false;
        emit(nextFen, selectedAnswer);
        return true;
    }

    function handleTurnChange(color: 'w' | 'b') {
        emit(setSideToMove(fen, color), selectedAnswer);
    }

    function handleAnswerChange(move: string) {
        emit(fen, move);
    }

    function handleClearBoard() {
        const chess = new Chess();
        chess.clear();
        emit(chess.fen(), '');
    }

    function handleStartingPosition() {
        emit(STARTING_FEN, '');
    }

    const sideToMove = fen.split(/\s+/)[1] === 'b' ? 'black' : 'white';

    return (
        <div
            data-testid="chess-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
            <ChessBoardView
                fen={fen}
                allowDragging
                onPieceDrop={handlePieceDrop}
                onSquareClick={handleSquareClick}
                boardWidth={400}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className="muted" style={{ marginRight: 4 }}>
                    Place pieces:
                </span>
                {PIECE_PALETTE.map((piece) => (
                    <button
                        key={`${piece.color}${piece.type}`}
                        type="button"
                        className="action-btn"
                        aria-pressed={
                            selectedPiece !== 'erase' &&
                            selectedPiece?.color === piece.color &&
                            selectedPiece?.type === piece.type
                        }
                        onClick={() =>
                            setSelectedPiece(
                                selectedPiece !== 'erase' &&
                                    selectedPiece?.color === piece.color &&
                                    selectedPiece?.type === piece.type
                                    ? null
                                    : piece
                            )
                        }
                        style={{ padding: '4px 10px', fontSize: '1.2em' }}
                        data-testid={`piece-${piece.color}${piece.type}`}
                    >
                        {piece.label}
                    </button>
                ))}
                <button
                    type="button"
                    className="action-btn"
                    aria-pressed={selectedPiece === 'erase'}
                    onClick={() => setSelectedPiece(selectedPiece === 'erase' ? null : 'erase')}
                    style={{ padding: '4px 10px' }}
                    data-testid="piece-erase"
                >
                    Erase
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="action-btn" onClick={handleStartingPosition}>
                    Starting position
                </button>
                <button type="button" className="action-btn" onClick={handleClearBoard}>
                    Clear board
                </button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span className="muted">Side to move:</span>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                        type="radio"
                        name="chess-side-to-move"
                        checked={sideToMove === 'white'}
                        onChange={() => handleTurnChange('w')}
                        data-testid="side-white"
                    />
                    White
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                        type="radio"
                        name="chess-side-to-move"
                        checked={sideToMove === 'black'}
                        onChange={() => handleTurnChange('b')}
                        data-testid="side-black"
                    />
                    Black
                </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                    Mate-in-1 move (answer)
                </label>
                <select
                    value={selectedAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    required
                    data-testid="chess-answer-select"
                    style={{ width: '100%', maxWidth: 320 }}
                >
                    <option value="">Select the mating move...</option>
                    {mateMoves.map((move) => (
                        <option key={move} value={move}>
                            {move}
                        </option>
                    ))}
                </select>
                {isValidChessFen(fen) && mateMoves.length === 0 && (
                    <div className="muted" style={{ fontSize: '0.9em' }}>
                        No mate-in-1 moves found for this position. Adjust the board or side to
                        move.
                    </div>
                )}
            </div>

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Select a piece, click squares to place it, drag pieces to move them, or choose Erase
                to remove a piece. Pick the correct mating move from the dropdown.
            </div>
        </div>
    );
}
