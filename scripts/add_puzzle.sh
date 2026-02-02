#!/bin/bash
#
# add_puzzle.sh - Add a puzzle to the database
#
# Usage:
#   ./scripts/add_puzzle.sh                           # Interactive mode
#   ./scripts/add_puzzle.sh DATE TYPE QUESTION ANSWER [HINT]
#
# Examples:
#   ./scripts/add_puzzle.sh 2026-02-05 word "Unscramble: ODERC" "coder" "Someone who programs"
#   ./scripts/add_puzzle.sh 2026-02-06 math "What is 12 × 8?" "96"
#
# Puzzle types: word, math, logic

set -e

DB_PATH="${DB_PATH:-puzzle.db}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}Error: sqlite3 is required but not installed.${NC}"
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    echo "Start the server once to create the database, or set DB_PATH."
    exit 1
fi

if [ $# -eq 0 ]; then
    echo -e "${CYAN}=== Add New Puzzle ===${NC}"
    echo ""

    echo -e "${YELLOW}Puzzle date (YYYY-MM-DD):${NC}"
    echo -n "  > "
    read -r PUZZLE_DATE

    if ! [[ "$PUZZLE_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo -e "${RED}Error: Invalid date format. Use YYYY-MM-DD${NC}"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}Puzzle type (word/math/logic):${NC}"
    echo -n "  > "
    read -r PUZZLE_TYPE

    if [[ ! "$PUZZLE_TYPE" =~ ^(word|math|logic)$ ]]; then
        echo -e "${RED}Error: Type must be 'word', 'math', or 'logic'${NC}"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}Question (what the user sees):${NC}"
    echo -n "  > "
    read -r QUESTION

    if [ -z "$QUESTION" ]; then
        echo -e "${RED}Error: Question cannot be empty${NC}"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}Answer (case-insensitive, whitespace-trimmed):${NC}"
    echo -n "  > "
    read -r ANSWER

    if [ -z "$ANSWER" ]; then
        echo -e "${RED}Error: Answer cannot be empty${NC}"
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}Hint (optional, press Enter to skip):${NC}"
    echo -n "  > "
    read -r HINT

else
    if [ $# -lt 4 ]; then
        echo "Usage: $0 DATE TYPE QUESTION ANSWER [HINT]"
        echo ""
        echo "  DATE     - Puzzle date in YYYY-MM-DD format"
        echo "  TYPE     - Puzzle type: word, math, or logic"
        echo "  QUESTION - The puzzle question"
        echo "  ANSWER   - The correct answer"
        echo "  HINT     - Optional hint text"
        echo ""
        echo "Example:"
        echo "  $0 2026-02-05 word \"Unscramble: ODERC\" \"coder\" \"Someone who programs\""
        exit 1
    fi

    PUZZLE_DATE="$1"
    PUZZLE_TYPE="$2"
    QUESTION="$3"
    ANSWER="$4"
    HINT="${5:-}"

    if ! [[ "$PUZZLE_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo -e "${RED}Error: Invalid date format. Use YYYY-MM-DD${NC}"
        exit 1
    fi

    if [[ ! "$PUZZLE_TYPE" =~ ^(word|math|logic)$ ]]; then
        echo -e "${RED}Error: Type must be 'word', 'math', or 'logic'${NC}"
        exit 1
    fi
fi

EXISTING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM puzzles WHERE puzzle_date = '$PUZZLE_DATE';")
if [ "$EXISTING" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Warning: A puzzle already exists for $PUZZLE_DATE${NC}"
    EXISTING_Q=$(sqlite3 "$DB_PATH" "SELECT question FROM puzzles WHERE puzzle_date = '$PUZZLE_DATE';")
    echo "  Existing: $EXISTING_Q"
    echo ""
    echo -n "Replace it? (y/N) "
    read -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    sqlite3 "$DB_PATH" "DELETE FROM puzzles WHERE puzzle_date = '$PUZZLE_DATE';"
fi

QUESTION_ESC="${QUESTION//\'/\'\'}"
ANSWER_ESC="${ANSWER//\'/\'\'}"
HINT_ESC="${HINT//\'/\'\'}"

if [ -z "$HINT" ]; then
    sqlite3 "$DB_PATH" "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer) VALUES ('$PUZZLE_DATE', '$PUZZLE_TYPE', '$QUESTION_ESC', '$ANSWER_ESC');"
else
    sqlite3 "$DB_PATH" "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer, hint) VALUES ('$PUZZLE_DATE', '$PUZZLE_TYPE', '$QUESTION_ESC', '$ANSWER_ESC', '$HINT_ESC');"
fi

echo ""
echo -e "${GREEN}✓ Puzzle added successfully!${NC}"
echo ""
echo "  Date:     $PUZZLE_DATE"
echo "  Type:     $PUZZLE_TYPE"
echo "  Question: $QUESTION"
echo "  Answer:   $ANSWER"
if [ -n "$HINT" ]; then
    echo "  Hint:     $HINT"
fi
echo ""

echo -e "${CYAN}Upcoming puzzles:${NC}"
sqlite3 -column -header "$DB_PATH" "SELECT puzzle_date, puzzle_type, substr(question, 1, 40) as question FROM puzzles WHERE puzzle_date >= date('now') ORDER BY puzzle_date LIMIT 5;"
