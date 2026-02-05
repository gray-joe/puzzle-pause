#include <stdio.h>
#include "db.h"

static sqlite3 *db = NULL;

static const char *SCHEMA =
    "CREATE TABLE IF NOT EXISTS users ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    email TEXT UNIQUE NOT NULL,"
    "    display_name TEXT,"
    "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ");"

    "CREATE TABLE IF NOT EXISTS auth_tokens ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    user_id INTEGER REFERENCES users(id),"
    "    email TEXT NOT NULL,"
    "    token TEXT UNIQUE NOT NULL,"
    "    short_code TEXT,"
    "    expires_at DATETIME NOT NULL,"
    "    used INTEGER DEFAULT 0,"
    "    attempts INTEGER DEFAULT 0"
    ");"

    "CREATE TABLE IF NOT EXISTS sessions ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    user_id INTEGER REFERENCES users(id) NOT NULL,"
    "    token TEXT UNIQUE NOT NULL,"
    "    expires_at DATETIME NOT NULL"
    ");"

    "CREATE TABLE IF NOT EXISTS puzzles ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    puzzle_date DATE UNIQUE NOT NULL,"
    "    puzzle_type TEXT NOT NULL,"
    "    puzzle_name TEXT NOT NULL DEFAULT '',"
    "    question TEXT NOT NULL,"
    "    answer TEXT NOT NULL,"
    "    hint TEXT,"
    "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ");"

    "CREATE TABLE IF NOT EXISTS attempts ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    user_id INTEGER REFERENCES users(id) NOT NULL,"
    "    puzzle_id INTEGER REFERENCES puzzles(id) NOT NULL,"
    "    completed_at DATETIME,"
    "    incorrect_guesses INTEGER DEFAULT 0,"
    "    hint_used INTEGER DEFAULT 0,"
    "    score INTEGER,"
    "    solved INTEGER DEFAULT 0,"
    "    UNIQUE(user_id, puzzle_id)"
    ");"

    "CREATE TABLE IF NOT EXISTS leagues ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    name TEXT NOT NULL,"
    "    invite_code TEXT UNIQUE NOT NULL,"
    "    creator_id INTEGER REFERENCES users(id) NOT NULL,"
    "    created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ");"

    "CREATE TABLE IF NOT EXISTS league_members ("
    "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "    league_id INTEGER REFERENCES leagues(id) NOT NULL,"
    "    user_id INTEGER REFERENCES users(id) NOT NULL,"
    "    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
    "    UNIQUE(league_id, user_id)"
    ");"

    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);"
    "CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);"
    "CREATE INDEX IF NOT EXISTS idx_puzzles_date ON puzzles(puzzle_date);"
    "CREATE INDEX IF NOT EXISTS idx_attempts_user_puzzle ON attempts(user_id, puzzle_id);"
    "CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);"
;

int db_init(const char *db_path) {
    char *err_msg = NULL;

    if (db_path == NULL)
        return -1;

    int rc = sqlite3_open(db_path, &db);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "Cannot open database: %s\n", sqlite3_errmsg(db));
        return -1;
    }

    /* SQLite has foreign keys OFF by default */
    rc = sqlite3_exec(db, "PRAGMA foreign_keys = ON;", NULL, NULL, &err_msg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "Failed to enable foreign keys: %s\n", err_msg);
        sqlite3_free(err_msg);
        return -1;
    }

    rc = sqlite3_exec(db, SCHEMA, NULL, NULL, &err_msg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "Failed to create schema: %s\n", err_msg);
        sqlite3_free(err_msg);
        return -1;
    }

    sqlite3_exec(db, "ALTER TABLE auth_tokens ADD COLUMN short_code TEXT", NULL, NULL, NULL);
    sqlite3_exec(db, "ALTER TABLE auth_tokens ADD COLUMN attempts INTEGER DEFAULT 0", NULL, NULL, NULL);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_code ON auth_tokens(email, short_code)", NULL, NULL, NULL);

    return 0;
}

void db_close(void) {
    if (db != NULL) {
        sqlite3_close(db);
        db = NULL;
    }
}

sqlite3 *db_get(void) {
    return db;
}
