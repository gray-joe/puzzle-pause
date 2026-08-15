'use client';

import dynamic from 'next/dynamic';
import type { ChessboardOptions } from 'react-chessboard';
import { sideToMoveLabel } from '@/lib/chessHelpers';

const Chessboard = dynamic(() => import('react-chessboard').then((mod) => mod.Chessboard), {
    ssr: false,
});

interface Props {
    fen: string;
    allowDragging?: boolean;
    onPieceDrop?: ChessboardOptions['onPieceDrop'];
    onSquareClick?: ChessboardOptions['onSquareClick'];
    boardWidth?: number;
}

export default function ChessBoardView({
    fen,
    allowDragging = false,
    onPieceDrop,
    onSquareClick,
    boardWidth = 360,
}: Props) {
    return (
        <div data-testid="chess-board" style={{ width: boardWidth, maxWidth: '100%' }}>
            <Chessboard
                options={{
                    position: fen,
                    allowDragging,
                    onPieceDrop,
                    onSquareClick,
                    boardStyle: {
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    },
                }}
            />
        </div>
    );
}

export function ChessTurnBanner({ fen }: { fen: string }) {
    return (
        <div
            data-testid="chess-turn-banner"
            style={{ fontSize: '1.05em', fontWeight: 600, marginBottom: 12 }}
        >
            {sideToMoveLabel(fen)} to move, mate in 1
        </div>
    );
}
