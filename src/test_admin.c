#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "test.h"
#include "db.h"
#include "auth.h"
#include "puzzle.h"
#include "sqlite3.h"

/* --- auth_is_admin tests --- */

TEST(test_admin_exact_match) {
    setenv("ADMIN_EMAILS", "admin@example.com", 1);
    ASSERT(auth_is_admin("admin@example.com") == 1);
    return 1;
}

TEST(test_admin_no_match) {
    setenv("ADMIN_EMAILS", "admin@example.com", 1);
    ASSERT(auth_is_admin("other@example.com") == 0);
    return 1;
}

TEST(test_admin_case_insensitive) {
    setenv("ADMIN_EMAILS", "Admin@Example.COM", 1);
    ASSERT(auth_is_admin("admin@example.com") == 1);
    return 1;
}

TEST(test_admin_multiple_emails) {
    setenv("ADMIN_EMAILS", "one@example.com,two@example.com,three@example.com", 1);
    ASSERT(auth_is_admin("two@example.com") == 1);
    ASSERT(auth_is_admin("three@example.com") == 1);
    ASSERT(auth_is_admin("four@example.com") == 0);
    return 1;
}

TEST(test_admin_spaces_around_emails) {
    setenv("ADMIN_EMAILS", " one@example.com , two@example.com ", 1);
    ASSERT(auth_is_admin("one@example.com") == 1);
    ASSERT(auth_is_admin("two@example.com") == 1);
    return 1;
}

TEST(test_admin_null_env) {
    unsetenv("ADMIN_EMAILS");
    ASSERT(auth_is_admin("admin@example.com") == 0);
    return 1;
}

TEST(test_admin_empty_email) {
    setenv("ADMIN_EMAILS", "admin@example.com", 1);
    ASSERT(auth_is_admin("") == 0);
    ASSERT(auth_is_admin(NULL) == 0);
    return 1;
}

/* --- puzzle CRUD tests --- */

static void setup_db(void) {
    remove("test_admin.db");
    db_init("test_admin.db");
}

static void teardown_db(void) {
    db_close();
    remove("test_admin.db");
}

TEST(test_puzzle_create) {
    setup_db();
    Puzzle p = {0};
    strncpy(p.puzzle_date, "2025-01-01", sizeof(p.puzzle_date) - 1);
    strncpy(p.puzzle_type, "anagram", sizeof(p.puzzle_type) - 1);
    strncpy(p.puzzle_name, "Test Puzzle", sizeof(p.puzzle_name) - 1);
    strncpy(p.question, "What is TSET?", sizeof(p.question) - 1);
    strncpy(p.answer, "TEST", sizeof(p.answer) - 1);
    strncpy(p.hint, "Reverse it", sizeof(p.hint) - 1);

    ASSERT(puzzle_create(&p) == 0);

    Puzzle loaded = {0};
    sqlite3 *db = db_get();
    int64_t id = sqlite3_last_insert_rowid(db);
    ASSERT(puzzle_get_by_id(id, &loaded) == 0);
    ASSERT_STR_EQ("2025-01-01", loaded.puzzle_date);
    ASSERT_STR_EQ("anagram", loaded.puzzle_type);
    ASSERT_STR_EQ("Test Puzzle", loaded.puzzle_name);
    ASSERT_STR_EQ("What is TSET?", loaded.question);
    ASSERT_STR_EQ("TEST", loaded.answer);
    ASSERT_STR_EQ("Reverse it", loaded.hint);

    teardown_db();
    return 1;
}

TEST(test_puzzle_create_duplicate_date) {
    setup_db();
    Puzzle p = {0};
    strncpy(p.puzzle_date, "2025-02-01", sizeof(p.puzzle_date) - 1);
    strncpy(p.puzzle_type, "anagram", sizeof(p.puzzle_type) - 1);
    strncpy(p.puzzle_name, "First", sizeof(p.puzzle_name) - 1);
    strncpy(p.question, "Q1", sizeof(p.question) - 1);
    strncpy(p.answer, "A1", sizeof(p.answer) - 1);

    ASSERT(puzzle_create(&p) == 0);

    Puzzle p2 = {0};
    strncpy(p2.puzzle_date, "2025-02-01", sizeof(p2.puzzle_date) - 1);
    strncpy(p2.puzzle_type, "anagram", sizeof(p2.puzzle_type) - 1);
    strncpy(p2.puzzle_name, "Second", sizeof(p2.puzzle_name) - 1);
    strncpy(p2.question, "Q2", sizeof(p2.question) - 1);
    strncpy(p2.answer, "A2", sizeof(p2.answer) - 1);

    ASSERT(puzzle_create(&p2) == -1);

    teardown_db();
    return 1;
}

TEST(test_puzzle_update) {
    setup_db();
    Puzzle p = {0};
    strncpy(p.puzzle_date, "2025-03-01", sizeof(p.puzzle_date) - 1);
    strncpy(p.puzzle_type, "anagram", sizeof(p.puzzle_type) - 1);
    strncpy(p.puzzle_name, "Original", sizeof(p.puzzle_name) - 1);
    strncpy(p.question, "Q", sizeof(p.question) - 1);
    strncpy(p.answer, "A", sizeof(p.answer) - 1);

    ASSERT(puzzle_create(&p) == 0);

    sqlite3 *db = db_get();
    int64_t id = sqlite3_last_insert_rowid(db);

    Puzzle updated = {0};
    updated.id = id;
    strncpy(updated.puzzle_date, "2025-03-02", sizeof(updated.puzzle_date) - 1);
    strncpy(updated.puzzle_type, "wordladder", sizeof(updated.puzzle_type) - 1);
    strncpy(updated.puzzle_name, "Updated", sizeof(updated.puzzle_name) - 1);
    strncpy(updated.question, "New Q", sizeof(updated.question) - 1);
    strncpy(updated.answer, "New A", sizeof(updated.answer) - 1);
    strncpy(updated.hint, "New hint", sizeof(updated.hint) - 1);

    ASSERT(puzzle_update(&updated) == 0);

    Puzzle loaded = {0};
    ASSERT(puzzle_get_by_id(id, &loaded) == 0);
    ASSERT_STR_EQ("2025-03-02", loaded.puzzle_date);
    ASSERT_STR_EQ("wordladder", loaded.puzzle_type);
    ASSERT_STR_EQ("Updated", loaded.puzzle_name);
    ASSERT_STR_EQ("New Q", loaded.question);
    ASSERT_STR_EQ("New A", loaded.answer);
    ASSERT_STR_EQ("New hint", loaded.hint);

    teardown_db();
    return 1;
}

TEST(test_puzzle_delete) {
    setup_db();

    /* Create a user */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "INSERT INTO users (email) VALUES ('test@test.com')", NULL, NULL, NULL);
    int64_t user_id = sqlite3_last_insert_rowid(db);

    /* Create a puzzle */
    Puzzle p = {0};
    strncpy(p.puzzle_date, "2025-04-01", sizeof(p.puzzle_date) - 1);
    strncpy(p.puzzle_type, "anagram", sizeof(p.puzzle_type) - 1);
    strncpy(p.puzzle_name, "To Delete", sizeof(p.puzzle_name) - 1);
    strncpy(p.question, "Q", sizeof(p.question) - 1);
    strncpy(p.answer, "A", sizeof(p.answer) - 1);
    ASSERT(puzzle_create(&p) == 0);
    int64_t puzzle_id = sqlite3_last_insert_rowid(db);

    /* Create an attempt for this puzzle */
    sqlite3_stmt *stmt = NULL;
    sqlite3_prepare_v2(db,
        "INSERT INTO attempts (user_id, puzzle_id, incorrect_guesses, hint_used, solved) "
        "VALUES (?, ?, 0, 0, 0)", -1, &stmt, NULL);
    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_int64(stmt, 2, puzzle_id);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    /* Delete should remove both puzzle and attempt */
    ASSERT(puzzle_delete(puzzle_id) == 0);

    Puzzle loaded = {0};
    ASSERT(puzzle_get_by_id(puzzle_id, &loaded) == -1);

    Attempt attempt = {0};
    ASSERT(puzzle_get_attempt(user_id, puzzle_id, &attempt) == -1);

    teardown_db();
    return 1;
}

int main(void) {
    test_init();

    RUN_TEST(test_admin_exact_match);
    RUN_TEST(test_admin_no_match);
    RUN_TEST(test_admin_case_insensitive);
    RUN_TEST(test_admin_multiple_emails);
    RUN_TEST(test_admin_spaces_around_emails);
    RUN_TEST(test_admin_null_env);
    RUN_TEST(test_admin_empty_email);
    RUN_TEST(test_puzzle_create);
    RUN_TEST(test_puzzle_create_duplicate_date);
    RUN_TEST(test_puzzle_update);
    RUN_TEST(test_puzzle_delete);

    return test_summary();
}
