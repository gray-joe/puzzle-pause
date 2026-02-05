/*
 * test_puzzle.c - Puzzle Tests
 *
 * Tests for puzzle logic: answer normalization, scoring, and attempts.
 */

#include <stdio.h>
#include <string.h>
#include <time.h>
#include "test.h"
#include "db.h"
#include "puzzle.h"
#include "util.h"
#include "sqlite3.h"

/*
 * Test: Answer normalization - lowercase
 */
TEST(test_normalize_lowercase) {
    char str[] = "PUZZLE";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("puzzle", str);
    return 1;
}

/*
 * Test: Answer normalization - trim whitespace
 */
TEST(test_normalize_trim) {
    char str[] = "  puzzle  ";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("puzzle", str);
    return 1;
}

/*
 * Test: Answer normalization - collapse spaces
 */
TEST(test_normalize_collapse_spaces) {
    char str[] = "two   words";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("two words", str);
    return 1;
}

/*
 * Test: Answer normalization - combined transformations
 */
TEST(test_normalize_combined) {
    char str[] = "  HELLO   WORLD  ";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("hello world", str);
    return 1;
}

/*
 * Test: Answer normalization - empty string
 */
TEST(test_normalize_empty) {
    char str[] = "";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("", str);
    return 1;
}

/*
 * Test: Answer normalization - only spaces
 */
TEST(test_normalize_only_spaces) {
    char str[] = "   ";
    puzzle_normalize_answer(str);
    ASSERT_STR_EQ("", str);
    return 1;
}

/*
 * Test: Score calculation - immediate solve (within 10 min)
 */
TEST(test_score_immediate) {
    /* Parse a fixed date and add 5 minutes after 09:00 UTC */
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;   /* January */
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 5;   /* 5 minutes after release */
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 0);

    ASSERT_INT_EQ(100, score);  /* Max score for solving within 10 min */
    return 1;
}

/*
 * Test: Score calculation - 15 minutes (10-30 min bracket)
 */
TEST(test_score_15min) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 15;
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 0);

    ASSERT_INT_EQ(90, score);
    return 1;
}

/*
 * Test: Score calculation - 45 minutes (30-60 min bracket)
 */
TEST(test_score_45min) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 45;
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 0);

    ASSERT_INT_EQ(80, score);
    return 1;
}

/*
 * Test: Score calculation - 90 minutes (1-2 hr bracket)
 */
TEST(test_score_90min) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 10;
    release.tm_min = 30;  /* 90 min after 09:00 */
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 0);

    ASSERT_INT_EQ(75, score);
    return 1;
}

/*
 * Test: Score calculation - 150 minutes (2-3 hr bracket)
 */
TEST(test_score_150min) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 11;
    release.tm_min = 30;  /* 150 min after 09:00 */
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 0);

    ASSERT_INT_EQ(70, score);
    return 1;
}

/*
 * Test: Score calculation - wrong guesses penalty
 */
TEST(test_score_wrong_guesses) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 5;
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 3, 0);

    /* 100 base - 15 (3 wrong guesses × 5) = 85 */
    ASSERT_INT_EQ(85, score);
    return 1;
}

/*
 * Test: Score calculation - hint penalty
 */
TEST(test_score_hint_used) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 5;
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 0, 1);

    /* 100 base - 10 (hint) = 90 */
    ASSERT_INT_EQ(90, score);
    return 1;
}

/*
 * Test: Score calculation - combined penalties
 */
TEST(test_score_combined_penalties) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 9;
    release.tm_min = 15;  /* 90 base score */
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 2, 1);

    /* 90 base - 10 (2 wrong × 5) - 10 (hint) = 70 */
    ASSERT_INT_EQ(70, score);
    return 1;
}

/*
 * Test: Score calculation - minimum score is 10
 */
TEST(test_score_minimum) {
    struct tm release = {0};
    release.tm_year = 2026 - 1900;
    release.tm_mon = 0;
    release.tm_mday = 26;
    release.tm_hour = 20;  /* Many hours after release */
    release.tm_min = 0;
    release.tm_sec = 0;

    time_t solve_time = timegm(&release);
    /* 20 wrong guesses would be -100 points in penalties */
    int score = puzzle_calculate_score(solve_time, "2026-01-26", 20, 1);

    /* Should never go below 10 */
    ASSERT_INT_EQ(10, score);
    return 1;
}

/*
 * Test: Get today's puzzle when one exists
 */
TEST(test_get_puzzle_exists) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    /* Insert a puzzle for today */
    char today[16];
    time_t now = (time_t)get_current_time();
    struct tm *tm = gmtime(&now);
    if (tm->tm_hour < 9) {
        now -= 86400;
        tm = gmtime(&now);
    }
    strftime(today, sizeof(today), "%Y-%m-%d", tm);

    const char *sql = "INSERT OR REPLACE INTO puzzles "
                      "(puzzle_date, puzzle_type, puzzle_name, question, answer, hint) "
                      "VALUES (?, 'word', 'Test Puzzle', 'Test question?', 'answer', 'hint')";
    sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    /* Now get the puzzle */
    Puzzle puzzle;
    ASSERT_INT_EQ(0, puzzle_get_today(&puzzle));
    ASSERT_STR_EQ(today, puzzle.puzzle_date);
    ASSERT_STR_EQ("word", puzzle.puzzle_type);
    ASSERT_STR_EQ("Test question?", puzzle.question);
    ASSERT_STR_EQ("answer", puzzle.answer);
    ASSERT_STR_EQ("hint", puzzle.hint);
    ASSERT_INT_EQ(1, puzzle.has_hint);

    return 1;
}

/*
 * Test: Submit correct guess
 */
TEST(test_submit_correct_guess) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    /* Create a test user */
    sqlite3_exec(db, "INSERT OR IGNORE INTO users (id, email) VALUES (999, 'test@test.com')", NULL, NULL, NULL);

    /* Get today's puzzle ID */
    char today[16];
    time_t now = (time_t)get_current_time();
    struct tm *tm = gmtime(&now);
    if (tm->tm_hour < 9) {
        now -= 86400;
        tm = gmtime(&now);
    }
    strftime(today, sizeof(today), "%Y-%m-%d", tm);

    /* Insert puzzle if not exists */
    const char *ins_sql = "INSERT OR REPLACE INTO puzzles "
                          "(puzzle_date, puzzle_type, puzzle_name, question, answer, hint) "
                          "VALUES (?, 'word', 'Test Puzzle', 'Test?', 'testanswer', 'hint')";
    sqlite3_prepare_v2(db, ins_sql, -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    /* Get puzzle ID */
    int64_t puzzle_id = 0;
    const char *sel_sql = "SELECT id FROM puzzles WHERE puzzle_date = ?";
    sqlite3_prepare_v2(db, sel_sql, -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        puzzle_id = sqlite3_column_int64(stmt, 0);
    }
    sqlite3_finalize(stmt);

    /* Clean up any existing attempt */
    sqlite3_exec(db, "DELETE FROM attempts WHERE user_id = 999", NULL, NULL, NULL);

    /* Submit correct guess (with different case and spaces) */
    int score = 0;
    int result = puzzle_submit_guess(999, puzzle_id, "  TESTANSWER  ", &score);

    ASSERT_INT_EQ(1, result);  /* 1 = correct */
    ASSERT(score >= 10);       /* Should have a valid score */

    /* Verify attempt was created and marked solved */
    Attempt attempt;
    ASSERT_INT_EQ(0, puzzle_get_attempt(999, puzzle_id, &attempt));
    ASSERT_INT_EQ(1, attempt.solved);
    ASSERT(attempt.score >= 10);

    return 1;
}

/*
 * Test: Submit incorrect guess
 */
TEST(test_submit_incorrect_guess) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    /* Get today's puzzle */
    char today[16];
    time_t now = (time_t)get_current_time();
    struct tm *tm = gmtime(&now);
    if (tm->tm_hour < 9) {
        now -= 86400;
        tm = gmtime(&now);
    }
    strftime(today, sizeof(today), "%Y-%m-%d", tm);

    /* Get puzzle ID */
    int64_t puzzle_id = 0;
    const char *sel_sql = "SELECT id FROM puzzles WHERE puzzle_date = ?";
    sqlite3_prepare_v2(db, sel_sql, -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        puzzle_id = sqlite3_column_int64(stmt, 0);
    }
    sqlite3_finalize(stmt);

    /* Clean up any existing attempt */
    sqlite3_exec(db, "DELETE FROM attempts WHERE user_id = 998", NULL, NULL, NULL);

    /* Create another test user */
    sqlite3_exec(db, "INSERT OR IGNORE INTO users (id, email) VALUES (998, 'test2@test.com')", NULL, NULL, NULL);

    /* Submit wrong guess */
    int result = puzzle_submit_guess(998, puzzle_id, "wronganswer", NULL);

    ASSERT_INT_EQ(0, result);  /* 0 = incorrect */

    /* Verify attempt tracks incorrect guess */
    Attempt attempt;
    ASSERT_INT_EQ(0, puzzle_get_attempt(998, puzzle_id, &attempt));
    ASSERT_INT_EQ(0, attempt.solved);
    ASSERT_INT_EQ(1, attempt.incorrect_guesses);

    return 1;
}

/*
 * Test: Reveal hint marks attempt
 */
TEST(test_reveal_hint) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    /* Get today's puzzle */
    char today[16];
    time_t now = (time_t)get_current_time();
    struct tm *tm = gmtime(&now);
    if (tm->tm_hour < 9) {
        now -= 86400;
        tm = gmtime(&now);
    }
    strftime(today, sizeof(today), "%Y-%m-%d", tm);

    /* Get puzzle ID */
    int64_t puzzle_id = 0;
    const char *sel_sql = "SELECT id FROM puzzles WHERE puzzle_date = ?";
    sqlite3_prepare_v2(db, sel_sql, -1, &stmt, NULL);
    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        puzzle_id = sqlite3_column_int64(stmt, 0);
    }
    sqlite3_finalize(stmt);

    /* Create test user and clean up */
    sqlite3_exec(db, "INSERT OR IGNORE INTO users (id, email) VALUES (997, 'test3@test.com')", NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM attempts WHERE user_id = 997", NULL, NULL, NULL);

    /* Reveal hint */
    char hint[512];
    int result = puzzle_reveal_hint(997, puzzle_id, hint, sizeof(hint));

    ASSERT_INT_EQ(0, result);
    ASSERT_STR_EQ("hint", hint);

    /* Verify attempt tracks hint usage */
    Attempt attempt;
    ASSERT_INT_EQ(0, puzzle_get_attempt(997, puzzle_id, &attempt));
    ASSERT_INT_EQ(1, attempt.hint_used);

    return 1;
}

TEST(test_parse_ladder_basic) {
    LadderStep steps[MAX_LADDER_STEPS];
    int count = puzzle_parse_ladder("Dawn, ____, Dark, ____, Dusk", steps, MAX_LADDER_STEPS);

    ASSERT_INT_EQ(5, count);

    ASSERT_STR_EQ("Dawn", steps[0].word);
    ASSERT_INT_EQ(0, steps[0].is_blank);

    ASSERT_INT_EQ(1, steps[1].is_blank);

    ASSERT_STR_EQ("Dark", steps[2].word);
    ASSERT_INT_EQ(0, steps[2].is_blank);

    ASSERT_INT_EQ(1, steps[3].is_blank);

    ASSERT_STR_EQ("Dusk", steps[4].word);
    ASSERT_INT_EQ(0, steps[4].is_blank);

    return 1;
}

TEST(test_parse_ladder_all_blanks) {
    LadderStep steps[MAX_LADDER_STEPS];
    int count = puzzle_parse_ladder("____, ____, ____", steps, MAX_LADDER_STEPS);

    ASSERT_INT_EQ(3, count);
    ASSERT_INT_EQ(1, steps[0].is_blank);
    ASSERT_INT_EQ(1, steps[1].is_blank);
    ASSERT_INT_EQ(1, steps[2].is_blank);

    return 1;
}

TEST(test_parse_ladder_empty) {
    LadderStep steps[MAX_LADDER_STEPS];
    int count = puzzle_parse_ladder("", steps, MAX_LADDER_STEPS);
    ASSERT_INT_EQ(0, count);
    return 1;
}

TEST(test_parse_choice_basic) {
    ChoicePuzzle cp;
    int rc = puzzle_parse_choice("What is 2+2?|3|4|5|6", &cp);
    ASSERT_INT_EQ(0, rc);
    ASSERT_STR_EQ("What is 2+2?", cp.prompt);
    ASSERT_INT_EQ(4, cp.num_options);
    ASSERT_STR_EQ("3", cp.options[0]);
    ASSERT_STR_EQ("4", cp.options[1]);
    ASSERT_STR_EQ("5", cp.options[2]);
    ASSERT_STR_EQ("6", cp.options[3]);
    return 1;
}

TEST(test_parse_choice_two_options) {
    ChoicePuzzle cp;
    int rc = puzzle_parse_choice("True or false: the sky is blue|True|False", &cp);
    ASSERT_INT_EQ(0, rc);
    ASSERT_STR_EQ("True or false: the sky is blue", cp.prompt);
    ASSERT_INT_EQ(2, cp.num_options);
    ASSERT_STR_EQ("True", cp.options[0]);
    ASSERT_STR_EQ("False", cp.options[1]);
    return 1;
}

TEST(test_parse_choice_no_options) {
    ChoicePuzzle cp;
    int rc = puzzle_parse_choice("Just a prompt with no pipe", &cp);
    ASSERT_INT_EQ(-1, rc);
    return 1;
}

int main(void) {
    /* Initialize database with test file */
    if (db_init("test_puzzle.db") != 0) {
        fprintf(stderr, "Failed to initialize test database\n");
        return 1;
    }

    test_init();

    /* Answer normalization tests */
    RUN_TEST(test_normalize_lowercase);
    RUN_TEST(test_normalize_trim);
    RUN_TEST(test_normalize_collapse_spaces);
    RUN_TEST(test_normalize_combined);
    RUN_TEST(test_normalize_empty);
    RUN_TEST(test_normalize_only_spaces);

    /* Score calculation tests */
    RUN_TEST(test_score_immediate);
    RUN_TEST(test_score_15min);
    RUN_TEST(test_score_45min);
    RUN_TEST(test_score_90min);
    RUN_TEST(test_score_150min);
    RUN_TEST(test_score_wrong_guesses);
    RUN_TEST(test_score_hint_used);
    RUN_TEST(test_score_combined_penalties);
    RUN_TEST(test_score_minimum);

    /* Ladder parsing tests */
    RUN_TEST(test_parse_ladder_basic);
    RUN_TEST(test_parse_ladder_all_blanks);
    RUN_TEST(test_parse_ladder_empty);

    /* Choice parsing tests */
    RUN_TEST(test_parse_choice_basic);
    RUN_TEST(test_parse_choice_two_options);
    RUN_TEST(test_parse_choice_no_options);

    /* Database integration tests */
    RUN_TEST(test_get_puzzle_exists);
    RUN_TEST(test_submit_correct_guess);
    RUN_TEST(test_submit_incorrect_guess);
    RUN_TEST(test_reveal_hint);

    db_close();
    return test_summary();
}
