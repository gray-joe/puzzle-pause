/*
 * test_db.c - Database Tests
 *
 * Tests for database initialization, schema, and basic operations.
 * Uses an in-memory database (":memory:") so tests don't affect real data.
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "test.h"
#include "db.h"
#include "sqlite3.h"

/* Helper: check if a table exists */
static int table_exists(const char *table_name) {
    sqlite3_stmt *stmt;
    const char *sql = "SELECT name FROM sqlite_master WHERE type='table' AND name=?";
    int exists = 0;

    if (sqlite3_prepare_v2(db_get(), sql, -1, &stmt, NULL) != SQLITE_OK) {
        return -1;
    }

    sqlite3_bind_text(stmt, 1, table_name, -1, SQLITE_STATIC);

    if (sqlite3_step(stmt) == SQLITE_ROW) {
        exists = 1;
    }

    sqlite3_finalize(stmt);
    return exists;
}

/*
 * Test: Database opens successfully
 */
TEST(test_db_init) {
    /* db_init was called in main(), verify connection works */
    ASSERT_NOT_NULL(db_get());
    return 1;
}

/*
 * Test: All required tables exist
 */
TEST(test_tables_exist) {
    ASSERT_INT_EQ(1, table_exists("users"));
    ASSERT_INT_EQ(1, table_exists("auth_tokens"));
    ASSERT_INT_EQ(1, table_exists("sessions"));
    ASSERT_INT_EQ(1, table_exists("puzzles"));
    ASSERT_INT_EQ(1, table_exists("attempts"));
    ASSERT_INT_EQ(1, table_exists("leagues"));
    ASSERT_INT_EQ(1, table_exists("league_members"));
    return 1;
}

/*
 * Test: Can insert and retrieve a user
 */
TEST(test_user_insert) {
    sqlite3 *db = db_get();
    char *err = NULL;
    int rc;

    /* Insert a test user */
    rc = sqlite3_exec(db,
        "INSERT INTO users (email, display_name) VALUES ('test@example.com', 'Test User')",
        NULL, NULL, &err);

    if (rc != SQLITE_OK) {
        printf("  Insert failed: %s\n", err);
        sqlite3_free(err);
        return 0;
    }

    /* Verify user was inserted */
    sqlite3_stmt *stmt;
    rc = sqlite3_prepare_v2(db,
        "SELECT email, display_name FROM users WHERE email = 'test@example.com'",
        -1, &stmt, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    rc = sqlite3_step(stmt);
    ASSERT_INT_EQ(SQLITE_ROW, rc);

    const char *email = (const char *)sqlite3_column_text(stmt, 0);
    const char *name = (const char *)sqlite3_column_text(stmt, 1);

    ASSERT_STR_EQ("test@example.com", email);
    ASSERT_STR_EQ("Test User", name);

    sqlite3_finalize(stmt);

    /* Cleanup: delete test user */
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'test@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Email uniqueness constraint works
 */
TEST(test_user_email_unique) {
    sqlite3 *db = db_get();
    int rc;

    /* Insert first user */
    rc = sqlite3_exec(db,
        "INSERT INTO users (email) VALUES ('unique@example.com')",
        NULL, NULL, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    /* Try to insert duplicate - should fail */
    rc = sqlite3_exec(db,
        "INSERT INTO users (email) VALUES ('unique@example.com')",
        NULL, NULL, NULL);
    ASSERT(rc != SQLITE_OK);  /* Should be SQLITE_CONSTRAINT */

    /* Cleanup */
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'unique@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Can insert and retrieve a puzzle
 */
TEST(test_puzzle_insert) {
    sqlite3 *db = db_get();
    int rc;

    /* Insert a test puzzle */
    rc = sqlite3_exec(db,
        "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer, hint) "
        "VALUES ('2024-01-26', 'word', 'What has keys but no locks?', 'keyboard', 'You type on it')",
        NULL, NULL, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    /* Verify puzzle was inserted */
    sqlite3_stmt *stmt;
    rc = sqlite3_prepare_v2(db,
        "SELECT puzzle_type, question, answer FROM puzzles WHERE puzzle_date = '2024-01-26'",
        -1, &stmt, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    rc = sqlite3_step(stmt);
    ASSERT_INT_EQ(SQLITE_ROW, rc);

    ASSERT_STR_EQ("word", (const char *)sqlite3_column_text(stmt, 0));
    ASSERT_STR_EQ("What has keys but no locks?", (const char *)sqlite3_column_text(stmt, 1));
    ASSERT_STR_EQ("keyboard", (const char *)sqlite3_column_text(stmt, 2));

    sqlite3_finalize(stmt);

    /* Cleanup */
    sqlite3_exec(db, "DELETE FROM puzzles WHERE puzzle_date = '2024-01-26'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Puzzle date uniqueness (one puzzle per day)
 */
TEST(test_puzzle_date_unique) {
    sqlite3 *db = db_get();
    int rc;

    /* Insert first puzzle for a date */
    rc = sqlite3_exec(db,
        "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer) "
        "VALUES ('2024-12-25', 'math', 'Q1', 'A1')",
        NULL, NULL, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    /* Try to insert another puzzle for same date - should fail */
    rc = sqlite3_exec(db,
        "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer) "
        "VALUES ('2024-12-25', 'logic', 'Q2', 'A2')",
        NULL, NULL, NULL);
    ASSERT(rc != SQLITE_OK);

    /* Cleanup */
    sqlite3_exec(db, "DELETE FROM puzzles WHERE puzzle_date = '2024-12-25'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Indexes exist for performance
 */
TEST(test_indexes_exist) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    int count = 0;

    /* Count indexes we created */
    int rc = sqlite3_prepare_v2(db,
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
        -1, &stmt, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        count++;
    }
    sqlite3_finalize(stmt);

    /* We should have at least 5 indexes */
    ASSERT(count >= 5);
    return 1;
}

/*
 * Main: Run all database tests
 */
int main(void) {
    printf("Database Tests\n");
    printf("==============\n\n");

    /* Initialize database with a test file */
    const char *test_db = "test_puzzle.db";
    unlink(test_db);  /* Remove if exists from previous run */

    if (db_init(test_db) != 0) {
        fprintf(stderr, "Failed to initialize test database\n");
        return 1;
    }

    printf("\n");
    test_init();

    /* Run tests */
    RUN_TEST(test_db_init);
    RUN_TEST(test_tables_exist);
    RUN_TEST(test_user_insert);
    RUN_TEST(test_user_email_unique);
    RUN_TEST(test_puzzle_insert);
    RUN_TEST(test_puzzle_date_unique);
    RUN_TEST(test_indexes_exist);

    int result = test_summary();

    /* Cleanup */
    db_close();
    unlink(test_db);

    return result;
}
