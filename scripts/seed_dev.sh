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
EOF

echo "Test user created: test@example.com"
echo ""
echo "Development database ready!"
echo "Run 'make run' to start the server (it will use data/dev.db by default)"
