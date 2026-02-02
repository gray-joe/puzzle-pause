#!/bin/bash
#
# test_http.sh - HTTP Endpoint Tests
#
# This script tests HTTP endpoints by running the actual server and
# making real HTTP requests.
#
# Exit codes: 0 = all tests passed, 1 = some tests failed

set -e  # Exit on first error

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local expected_status="$4"
    local expected_body="$5"

    TESTS_RUN=$((TESTS_RUN + 1))
    printf "Testing %s... " "$name"

    local tmpfile=$(mktemp)
    status=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "$url" 2>/dev/null)
    body=$(cat "$tmpfile")
    rm -f "$tmpfile"

    if [ "$status" != "$expected_status" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Expected status $expected_status, got $status"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi

    if [ -n "$expected_body" ]; then
        if ! echo "$body" | grep -q "$expected_body"; then
            echo -e "${RED}FAIL${NC}"
            echo "  Body doesn't contain: $expected_body"
            echo "  Got: $body"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            return 1
        fi
    fi

    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
}

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    rm -f test_http.db
}

trap cleanup EXIT

echo "HTTP Endpoint Tests"
echo "==================="
echo ""

echo "Building server..."
make puzzle_server > /dev/null 2>&1

rm -f test_http.db

echo "Starting server..."
./puzzle_server &
SERVER_PID=$!

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Failed to start server"
    exit 1
fi

echo "Server running (PID: $SERVER_PID)"
echo ""

test_endpoint "GET /health returns OK" \
    "GET" "http://localhost:8080/health" "200" "OK"

test_endpoint "GET / returns home page" \
    "GET" "http://localhost:8080/" "200" "Daily Puzzle"

test_endpoint "GET / contains login link" \
    "GET" "http://localhost:8080/" "200" "Login"

test_endpoint "GET /login returns login form" \
    "GET" "http://localhost:8080/login" "200" "email"

test_endpoint "GET /login has form action" \
    "GET" "http://localhost:8080/login" "200" 'action="/login"'

test_endpoint "GET /nonexistent returns 404" \
    "GET" "http://localhost:8080/nonexistent" "404" "Not Found"

test_endpoint "GET /api/anything returns 404" \
    "GET" "http://localhost:8080/api/anything" "404" ""

echo ""
echo "========================================"
echo "Tests run: $TESTS_RUN, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED"
echo "========================================"

if [ "$TESTS_FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
