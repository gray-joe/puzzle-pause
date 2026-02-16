#!/bin/bash
#
# Seed the development database with test data.
# This resets the dev database and populates it with sample puzzles and users.
#
# Usage: ./scripts/seed_dev.sh
#

set -e

DB_PATH="data/dev.db"
SEED_SQL="data/seed_puzzles.sql"

echo "Seeding development database: $DB_PATH"

rm -f "$DB_PATH"

sqlite3 "$DB_PATH" <<'EOF'
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Authentication tokens (magic links)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Puzzles
CREATE TABLE IF NOT EXISTS puzzles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_date DATE UNIQUE NOT NULL,
    puzzle_type TEXT NOT NULL,
    puzzle_name TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    hint TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User attempts at puzzles
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    puzzle_id INTEGER NOT NULL,
    incorrect_guesses INTEGER DEFAULT 0,
    hint_used INTEGER DEFAULT 0,
    solved INTEGER DEFAULT 0,
    score INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id),
    UNIQUE(user_id, puzzle_id)
);

-- Mini leagues
CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    creator_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- League membership
CREATE TABLE IF NOT EXISTS league_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(league_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_puzzles_date ON puzzles(puzzle_date);
CREATE INDEX IF NOT EXISTS idx_attempts_user_puzzle ON attempts(user_id, puzzle_id);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);
EOF

echo "Schema created."

if [ -f "$SEED_SQL" ]; then
    sqlite3 "$DB_PATH" < "$SEED_SQL"
    echo "Puzzles seeded from $SEED_SQL"
else
    echo "Warning: $SEED_SQL not found, skipping puzzle seed"
fi

sqlite3 "$DB_PATH" <<'EOF'
INSERT OR IGNORE INTO users (email, display_name) VALUES ('test@example.com', 'Test User');
INSERT OR IGNORE INTO users (email, display_name) VALUES ('alice@example.com', 'Alice');
INSERT OR IGNORE INTO users (email, display_name) VALUES ('bob@example.com', 'Bob');
INSERT OR IGNORE INTO users (email, display_name) VALUES ('charlie@example.com', 'Charlie');

-- Dev league with all 4 users
INSERT OR IGNORE INTO leagues (id, name, invite_code, creator_id) VALUES (1, 'Dev League', 'DEV001', 1);
INSERT OR IGNORE INTO league_members (league_id, user_id) VALUES (1, 1);
INSERT OR IGNORE INTO league_members (league_id, user_id) VALUES (1, 2);
INSERT OR IGNORE INTO league_members (league_id, user_id) VALUES (1, 3);
INSERT OR IGNORE INTO league_members (league_id, user_id) VALUES (1, 4);

-- Attempts: each user plays puzzles 1-5 (past dates) to trigger tags
-- Test User: solid scores, a few wrong guesses, no hints, completes ~11:00
INSERT OR IGNORE INTO attempts (user_id, puzzle_id, solved, score, incorrect_guesses, hint_used, completed_at)
VALUES
(1, 1, 1, 90, 1, 0, '2026-02-06 11:00:00'),
(1, 2, 1, 85, 0, 0, '2026-02-07 11:30:00'),
(1, 3, 1, 80, 1, 0, '2026-02-08 10:30:00'),
(1, 4, 1, 95, 0, 0, '2026-02-09 11:00:00'),
(1, 5, 1, 75, 2, 0, '2026-02-10 11:00:00');

-- Alice (id=2): "The Guesser" — lots of wrong guesses
INSERT OR IGNORE INTO attempts (user_id, puzzle_id, solved, score, incorrect_guesses, hint_used, completed_at)
VALUES
(2, 1, 1, 60, 3, 0, '2026-02-06 12:00:00'),
(2, 2, 1, 55, 4, 0, '2026-02-07 13:00:00'),
(2, 3, 1, 50, 5, 0, '2026-02-08 12:30:00'),
(2, 4, 1, 65, 2, 0, '2026-02-09 12:00:00'),
(2, 5, 1, 45, 3, 0, '2026-02-10 14:00:00');

-- Bob (id=3): "The One Shotter" + "The Early Riser" — all first-try, completes ~09:15
INSERT OR IGNORE INTO attempts (user_id, puzzle_id, solved, score, incorrect_guesses, hint_used, completed_at)
VALUES
(3, 1, 1, 100, 0, 0, '2026-02-06 09:10:00'),
(3, 2, 1, 100, 0, 0, '2026-02-07 09:15:00'),
(3, 3, 1, 100, 0, 0, '2026-02-08 09:20:00'),
(3, 4, 1, 100, 0, 0, '2026-02-09 09:12:00'),
(3, 5, 1, 100, 0, 0, '2026-02-10 09:18:00');

-- Charlie (id=4): "The Hint Lover" — uses hints every time
INSERT OR IGNORE INTO attempts (user_id, puzzle_id, solved, score, incorrect_guesses, hint_used, completed_at)
VALUES
(4, 1, 1, 70, 0, 1, '2026-02-06 10:00:00'),
(4, 2, 1, 65, 1, 1, '2026-02-07 10:30:00'),
(4, 3, 1, 60, 0, 1, '2026-02-08 10:00:00'),
(4, 4, 1, 75, 0, 1, '2026-02-09 10:15:00'),
(4, 5, 1, 55, 1, 1, '2026-02-10 10:45:00');
EOF

echo "Test users created: test@example.com, alice@example.com, bob@example.com, charlie@example.com"
echo "Dev League created (invite code: DEV001) with all 4 users"
echo ""
echo "Tags you should see:"
echo "  Alice  -> The Guesser (17 wrong guesses)"
echo "  Bob    -> The One Shotter (5/5 first-try) + The Early Riser (~09:15)"
echo "  Charlie -> The Hint Lover (5 hints used)"
echo ""
echo "Development database ready!"
echo "Run 'make run' to start the server (it will use data/dev.db by default)"
