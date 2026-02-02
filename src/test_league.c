/*
 * test_league.c - Mini Leagues Tests
 *
 * Tests for league creation, membership, and leaderboards.
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <ctype.h>
#include "test.h"
#include "db.h"
#include "league.h"
#include "sqlite3.h"

/*
 * Helper: Create a test user and return their ID.
 */
static int64_t create_test_user(const char *email) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    int rc = sqlite3_prepare_v2(db,
        "INSERT INTO users (email) VALUES (?)",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK) return -1;

    sqlite3_bind_text(stmt, 1, email, -1, SQLITE_STATIC);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) return -1;
    return sqlite3_last_insert_rowid(db);
}

/*
 * Helper: Delete a test user.
 */
static void delete_test_user(int64_t user_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    sqlite3_prepare_v2(db, "DELETE FROM users WHERE id = ?", -1, &stmt, NULL);
    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

/*
 * Helper: Create a puzzle for today and return its ID.
 */
static int64_t create_today_puzzle(void) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    int rc = sqlite3_prepare_v2(db,
        "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer) "
        "VALUES (date('now'), 'word', 'Test question', 'answer')",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK) return -1;

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) return -1;
    return sqlite3_last_insert_rowid(db);
}

/*
 * Helper: Record a solved attempt for a user.
 */
static void record_attempt(int64_t user_id, int64_t puzzle_id, int score) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    sqlite3_prepare_v2(db,
        "INSERT INTO attempts (user_id, puzzle_id, solved, score, completed_at) "
        "VALUES (?, ?, 1, ?, datetime('now'))",
        -1, &stmt, NULL);
    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_int64(stmt, 2, puzzle_id);
    sqlite3_bind_int(stmt, 3, score);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

/*
 * Test: Create a league successfully
 */
TEST(test_league_create) {
    int64_t user_id = create_test_user("creator@test.com");
    ASSERT(user_id > 0);

    char invite_code[8];
    int64_t league_id = league_create(user_id, "Test League", invite_code);
    ASSERT(league_id > 0);

    /* Invite code should be 6 uppercase alphanumeric characters */
    ASSERT_INT_EQ(6, (int)strlen(invite_code));
    for (int i = 0; i < 6; i++) {
        ASSERT(isupper((unsigned char)invite_code[i]) || isdigit((unsigned char)invite_code[i]));
    }

    /* Creator should be a member */
    ASSERT_INT_EQ(1, league_is_member(league_id, user_id));

    /* Cleanup */
    league_delete(league_id, user_id);
    delete_test_user(user_id);

    return 1;
}

/*
 * Test: Get league by ID
 */
TEST(test_league_get) {
    int64_t user_id = create_test_user("get@test.com");
    char invite_code[8];
    int64_t league_id = league_create(user_id, "Get Test League", invite_code);

    League league;
    ASSERT_INT_EQ(0, league_get(league_id, &league));
    ASSERT_INT_EQ((int)league_id, (int)league.id);
    ASSERT_STR_EQ("Get Test League", league.name);
    ASSERT_STR_EQ(invite_code, league.invite_code);
    ASSERT_INT_EQ((int)user_id, (int)league.creator_id);
    ASSERT_INT_EQ(1, league.member_count);

    /* Cleanup */
    league_delete(league_id, user_id);
    delete_test_user(user_id);

    return 1;
}

/*
 * Test: Get league by invite code
 */
TEST(test_league_get_by_code) {
    int64_t user_id = create_test_user("code@test.com");
    char invite_code[8];
    int64_t league_id = league_create(user_id, "Code Test League", invite_code);

    League league;
    ASSERT_INT_EQ(0, league_get_by_code(invite_code, &league));
    ASSERT_INT_EQ((int)league_id, (int)league.id);

    /* Should also work with lowercase */
    char lower_code[8];
    for (int i = 0; invite_code[i]; i++) {
        lower_code[i] = tolower((unsigned char)invite_code[i]);
    }
    lower_code[6] = '\0';
    ASSERT_INT_EQ(0, league_get_by_code(lower_code, &league));
    ASSERT_INT_EQ((int)league_id, (int)league.id);

    /* Cleanup */
    league_delete(league_id, user_id);
    delete_test_user(user_id);

    return 1;
}

/*
 * Test: Invalid invite code returns error
 */
TEST(test_league_invalid_code) {
    League league;
    ASSERT_INT_EQ(-1, league_get_by_code("XXXXXX", &league));
    return 1;
}

/*
 * Test: Join a league
 */
TEST(test_league_join) {
    int64_t creator_id = create_test_user("join_creator@test.com");
    int64_t joiner_id = create_test_user("joiner@test.com");

    char invite_code[8];
    int64_t league_id = league_create(creator_id, "Join Test League", invite_code);

    /* User should not be a member yet */
    ASSERT_INT_EQ(0, league_is_member(league_id, joiner_id));

    /* Join the league */
    ASSERT_INT_EQ(0, league_join(league_id, joiner_id));

    /* User should now be a member */
    ASSERT_INT_EQ(1, league_is_member(league_id, joiner_id));

    /* Member count should be 2 */
    League league;
    league_get(league_id, &league);
    ASSERT_INT_EQ(2, league.member_count);

    /* Cleanup */
    league_delete(league_id, creator_id);
    delete_test_user(creator_id);
    delete_test_user(joiner_id);

    return 1;
}

/*
 * Test: Cannot join a league twice
 */
TEST(test_league_join_twice) {
    int64_t user_id = create_test_user("twice@test.com");
    char invite_code[8];
    int64_t league_id = league_create(user_id, "Twice Test League", invite_code);

    /* Creator is already a member, joining again should fail */
    ASSERT_INT_EQ(-1, league_join(league_id, user_id));

    /* Cleanup */
    league_delete(league_id, user_id);
    delete_test_user(user_id);

    return 1;
}

/*
 * Test: Cannot join non-existent league
 */
TEST(test_league_join_invalid) {
    int64_t user_id = create_test_user("invalid_join@test.com");

    ASSERT_INT_EQ(-1, league_join(999999, user_id));

    delete_test_user(user_id);
    return 1;
}

/*
 * Test: Leave a league (normal member)
 */
TEST(test_league_leave_member) {
    int64_t creator_id = create_test_user("leave_creator@test.com");
    int64_t member_id = create_test_user("leave_member@test.com");

    char invite_code[8];
    int64_t league_id = league_create(creator_id, "Leave Test League", invite_code);
    league_join(league_id, member_id);

    /* Member leaves */
    ASSERT_INT_EQ(0, league_leave(league_id, member_id));
    ASSERT_INT_EQ(0, league_is_member(league_id, member_id));

    /* Creator should still be a member */
    ASSERT_INT_EQ(1, league_is_member(league_id, creator_id));

    /* Cleanup */
    league_delete(league_id, creator_id);
    delete_test_user(creator_id);
    delete_test_user(member_id);

    return 1;
}

/*
 * Test: Creator leaving transfers ownership
 */
TEST(test_league_leave_creator_transfers) {
    int64_t creator_id = create_test_user("old_creator@test.com");
    int64_t member_id = create_test_user("new_creator@test.com");

    char invite_code[8];
    int64_t league_id = league_create(creator_id, "Transfer Test League", invite_code);
    league_join(league_id, member_id);

    /* Creator leaves */
    ASSERT_INT_EQ(0, league_leave(league_id, creator_id));

    /* Old creator should no longer be a member */
    ASSERT_INT_EQ(0, league_is_member(league_id, creator_id));

    /* New member should now be the creator */
    League league;
    league_get(league_id, &league);
    ASSERT_INT_EQ((int)member_id, (int)league.creator_id);

    /* Cleanup (new creator can delete) */
    league_delete(league_id, member_id);
    delete_test_user(creator_id);
    delete_test_user(member_id);

    return 1;
}

/*
 * Test: Last member leaving deletes league
 */
TEST(test_league_leave_last_member) {
    int64_t user_id = create_test_user("alone@test.com");
    char invite_code[8];
    int64_t league_id = league_create(user_id, "Alone League", invite_code);

    /* Leave the league (only member) */
    ASSERT_INT_EQ(0, league_leave(league_id, user_id));

    /* League should no longer exist */
    League league;
    ASSERT_INT_EQ(-1, league_get(league_id, &league));

    delete_test_user(user_id);
    return 1;
}

/*
 * Test: Delete league (creator only)
 */
TEST(test_league_delete) {
    int64_t creator_id = create_test_user("delete_creator@test.com");
    int64_t member_id = create_test_user("delete_member@test.com");

    char invite_code[8];
    int64_t league_id = league_create(creator_id, "Delete Test League", invite_code);
    league_join(league_id, member_id);

    /* Non-creator cannot delete */
    ASSERT_INT_EQ(-1, league_delete(league_id, member_id));

    /* Creator can delete */
    ASSERT_INT_EQ(0, league_delete(league_id, creator_id));

    /* League should no longer exist */
    League league;
    ASSERT_INT_EQ(-1, league_get(league_id, &league));

    delete_test_user(creator_id);
    delete_test_user(member_id);

    return 1;
}

/*
 * Test: Get user's leagues
 */
TEST(test_league_get_user_leagues) {
    int64_t user_id = create_test_user("multi@test.com");
    char code1[8], code2[8];

    int64_t league1 = league_create(user_id, "League One", code1);
    int64_t league2 = league_create(user_id, "League Two", code2);

    League leagues[10];
    int count;
    ASSERT_INT_EQ(0, league_get_user_leagues(user_id, leagues, 10, &count));
    ASSERT_INT_EQ(2, count);

    /* Cleanup */
    league_delete(league1, user_id);
    league_delete(league2, user_id);
    delete_test_user(user_id);

    return 1;
}

/*
 * Test: Today's leaderboard
 */
TEST(test_leaderboard_today) {
    int64_t user1 = create_test_user("leader1@test.com");
    int64_t user2 = create_test_user("leader2@test.com");
    int64_t user3 = create_test_user("leader3@test.com");

    char invite_code[8];
    int64_t league_id = league_create(user1, "Leaderboard League", invite_code);
    league_join(league_id, user2);
    league_join(league_id, user3);

    int64_t puzzle_id = create_today_puzzle();

    /* User1 scores 100, User2 scores 80, User3 doesn't solve */
    record_attempt(user1, puzzle_id, 100);
    record_attempt(user2, puzzle_id, 80);

    LeaderboardEntry entries[10];
    int count;
    ASSERT_INT_EQ(0, league_get_leaderboard_today(league_id, entries, 10, &count));
    ASSERT_INT_EQ(3, count);

    /* User1 should be first with 100 */
    ASSERT_INT_EQ((int)user1, (int)entries[0].user_id);
    ASSERT_INT_EQ(100, entries[0].score);
    ASSERT_INT_EQ(1, entries[0].rank);

    /* User2 should be second with 80 */
    ASSERT_INT_EQ((int)user2, (int)entries[1].user_id);
    ASSERT_INT_EQ(80, entries[1].score);
    ASSERT_INT_EQ(2, entries[1].rank);

    /* User3 should be last with -1 (unsolved) */
    ASSERT_INT_EQ((int)user3, (int)entries[2].user_id);
    ASSERT_INT_EQ(-1, entries[2].score);

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM attempts", NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM puzzles", NULL, NULL, NULL);
    league_delete(league_id, user1);
    delete_test_user(user1);
    delete_test_user(user2);
    delete_test_user(user3);

    return 1;
}

/*
 * Test: All-time leaderboard
 */
TEST(test_leaderboard_alltime) {
    int64_t user1 = create_test_user("alltime1@test.com");
    int64_t user2 = create_test_user("alltime2@test.com");

    char invite_code[8];
    int64_t league_id = league_create(user1, "Alltime League", invite_code);
    league_join(league_id, user2);

    /* Create two puzzles */
    int64_t puzzle1 = create_today_puzzle();
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    sqlite3_prepare_v2(db,
        "INSERT INTO puzzles (puzzle_date, puzzle_type, question, answer) "
        "VALUES (date('now', '-1 day'), 'word', 'Yesterday', 'yes')",
        -1, &stmt, NULL);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    int64_t puzzle2 = sqlite3_last_insert_rowid(db);

    /* User1: 100 + 90 = 190, User2: 80 only */
    record_attempt(user1, puzzle1, 100);
    record_attempt(user1, puzzle2, 90);
    record_attempt(user2, puzzle1, 80);

    LeaderboardEntry entries[10];
    int count;
    ASSERT_INT_EQ(0, league_get_leaderboard_alltime(league_id, entries, 10, &count));
    ASSERT_INT_EQ(2, count);

    ASSERT_INT_EQ((int)user1, (int)entries[0].user_id);
    ASSERT_INT_EQ(190, entries[0].score);

    ASSERT_INT_EQ((int)user2, (int)entries[1].user_id);
    ASSERT_INT_EQ(80, entries[1].score);

    /* Cleanup */
    sqlite3_exec(db, "DELETE FROM attempts", NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM puzzles", NULL, NULL, NULL);
    league_delete(league_id, user1);
    delete_test_user(user1);
    delete_test_user(user2);

    return 1;
}

/*
 * Test: Tied scores get same rank
 */
TEST(test_leaderboard_ties) {
    int64_t user1 = create_test_user("tie1@test.com");
    int64_t user2 = create_test_user("tie2@test.com");
    int64_t user3 = create_test_user("tie3@test.com");

    char invite_code[8];
    int64_t league_id = league_create(user1, "Tie League", invite_code);
    league_join(league_id, user2);
    league_join(league_id, user3);

    int64_t puzzle_id = create_today_puzzle();

    /* User1 and User2 both score 100 (tie), User3 scores 80 */
    record_attempt(user1, puzzle_id, 100);
    record_attempt(user2, puzzle_id, 100);
    record_attempt(user3, puzzle_id, 80);

    LeaderboardEntry entries[10];
    int count;
    league_get_leaderboard_today(league_id, entries, 10, &count);

    /* Both 100-scorers should have rank 1 */
    ASSERT_INT_EQ(1, entries[0].rank);
    ASSERT_INT_EQ(1, entries[1].rank);
    /* 80-scorer should have rank 3 (skips 2) */
    ASSERT_INT_EQ(3, entries[2].rank);

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM attempts", NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM puzzles", NULL, NULL, NULL);
    league_delete(league_id, user1);
    delete_test_user(user1);
    delete_test_user(user2);
    delete_test_user(user3);

    return 1;
}

int main(void) {
    printf("League Tests\n");
    printf("============\n\n");

    /* Initialize database */
    const char *test_db = "test_league.db";
    unlink(test_db);

    if (db_init(test_db) != 0) {
        fprintf(stderr, "Failed to initialize test database\n");
        return 1;
    }

    printf("\n");
    test_init();

    /* Creation tests */
    RUN_TEST(test_league_create);
    RUN_TEST(test_league_get);
    RUN_TEST(test_league_get_by_code);
    RUN_TEST(test_league_invalid_code);

    /* Membership tests */
    RUN_TEST(test_league_join);
    RUN_TEST(test_league_join_twice);
    RUN_TEST(test_league_join_invalid);
    RUN_TEST(test_league_leave_member);
    RUN_TEST(test_league_leave_creator_transfers);
    RUN_TEST(test_league_leave_last_member);
    RUN_TEST(test_league_delete);
    RUN_TEST(test_league_get_user_leagues);

    /* Leaderboard tests */
    RUN_TEST(test_leaderboard_today);
    RUN_TEST(test_leaderboard_alltime);
    RUN_TEST(test_leaderboard_ties);

    int result = test_summary();

    db_close();
    unlink(test_db);

    return result;
}
