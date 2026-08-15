"""Chess puzzle helpers built on python-chess."""

from __future__ import annotations

import json
import re

import chess


def parse_chess_question(question: str) -> dict:
    try:
        data = json.loads(question)
    except json.JSONDecodeError as e:
        raise ValueError(f"question must be valid JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValueError("question JSON must be an object")
    if "fen" not in data:
        raise ValueError("question JSON missing required field: 'fen'")
    fen = data["fen"]
    if not isinstance(fen, str) or not fen.strip():
        raise ValueError("chess question 'fen' must be a non-empty string")
    return data


def board_from_question(question: str) -> chess.Board:
    data = parse_chess_question(question)
    try:
        board = chess.Board(data["fen"].strip())
    except ValueError as e:
        raise ValueError(f"chess question 'fen' is not valid: {e}") from e
    return board


def side_to_move_label(board: chess.Board) -> str:
    return "White" if board.turn == chess.WHITE else "Black"


def mate_in_one_moves(board: chess.Board) -> list[chess.Move]:
    mates: list[chess.Move] = []
    for move in board.legal_moves:
        board.push(move)
        if board.is_checkmate():
            mates.append(move)
        board.pop()
    return mates


def _normalize_san(san: str) -> str:
    return re.sub(r"[+#?!]+$", "", san.strip())


def _parse_guess_move(board: chess.Board, guess: str) -> chess.Move | None:
    text = guess.strip()
    if not text:
        return None

    try:
        return board.parse_san(text)
    except ValueError:
        pass

    normalized = _normalize_san(text)
    if normalized != text:
        try:
            return board.parse_san(normalized)
        except ValueError:
            pass

    compact = re.sub(r"\s+", "", text.lower())
    if re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", compact):
        try:
            return chess.Move.from_uci(compact)
        except ValueError:
            return None

    return None


def _answer_variants(answer: str) -> list[str]:
    return [part.strip() for part in answer.split("|") if part.strip()]


def validate_chess_puzzle(question: str, answer: str) -> None:
    board = board_from_question(question)
    answers = _answer_variants(answer)
    if not answers:
        raise ValueError("chess answer must not be empty")

    mates = mate_in_one_moves(board)
    if not mates:
        raise ValueError("chess position must have at least one mate-in-1 move")

    mate_sans = {_normalize_san(board.san(move)) for move in mates}
    mate_ucis = {move.uci() for move in mates}

    for candidate in answers:
        move = _parse_guess_move(board, candidate)
        if move is None:
            raise ValueError(
                f"chess answer '{candidate}' is not a valid move in SAN or UCI notation"
            )
        if move not in mates:
            raise ValueError(
                f"chess answer '{candidate}' is not a mate-in-1 move for this position"
            )
        if _normalize_san(board.san(move)) not in mate_sans and move.uci() not in mate_ucis:
            raise ValueError(
                f"chess answer '{candidate}' is not a mate-in-1 move for this position"
            )


def check_chess_answer(question: str, answer: str, guess: str) -> bool:
    board = board_from_question(question)
    guess_move = _parse_guess_move(board, guess)
    if guess_move is None or guess_move not in board.legal_moves:
        return False

    board.push(guess_move)
    if not board.is_checkmate():
        return False

    accepted_moves: set[chess.Move] = set()
    for candidate in _answer_variants(answer):
        parsed = _parse_guess_move(chess.Board(parse_chess_question(question)["fen"].strip()), candidate)
        if parsed is not None:
            accepted_moves.add(parsed)

    return guess_move in accepted_moves
