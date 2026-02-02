/*
 * test_auth.c - Authentication Tests
 *
 * Tests for token generation, magic links, and session management.
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "test.h"
#include "db.h"
#include "auth.h"
#include "util.h"
#include "sqlite3.h"

/*
 * Test: Random bytes generation produces different values
 */
TEST(test_random_bytes) {
    unsigned char buf1[32], buf2[32];

    ASSERT_INT_EQ(0, generate_random_bytes(buf1, sizeof(buf1)));
    ASSERT_INT_EQ(0, generate_random_bytes(buf2, sizeof(buf2)));

    /* Two random generations should be different */
    ASSERT(memcmp(buf1, buf2, sizeof(buf1)) != 0);

    return 1;
}

/*
 * Test: Token generation produces valid hex string
 */
TEST(test_token_generation) {
    char token[65];

    ASSERT_INT_EQ(0, generate_token_hex(token, sizeof(token), 32));

    /* Should be 64 hex characters */
    ASSERT_INT_EQ(64, (int)strlen(token));

    /* All characters should be hex (0-9, a-f) */
    for (int i = 0; i < 64; i++) {
        char c = token[i];
        int is_hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
        ASSERT(is_hex);
    }

    return 1;
}

/*
 * Test: Two tokens are different
 */
TEST(test_token_uniqueness) {
    char token1[65], token2[65];

    ASSERT_INT_EQ(0, generate_token_hex(token1, sizeof(token1), 32));
    ASSERT_INT_EQ(0, generate_token_hex(token2, sizeof(token2), 32));

    /* Tokens should be different */
    ASSERT(strcmp(token1, token2) != 0);

    return 1;
}

/*
 * Test: Token buffer too small fails gracefully
 */
TEST(test_token_buffer_too_small) {
    char small_buf[10];

    /* Should fail - buffer too small for 32 bytes (64 hex chars + null) */
    ASSERT_INT_EQ(-1, generate_token_hex(small_buf, sizeof(small_buf), 32));

    return 1;
}

/*
 * Test: Create magic link stores token in database
 */
TEST(test_create_magic_link) {
    char token[65];
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    /* Create magic link */
    ASSERT_INT_EQ(0, auth_create_magic_link("test@example.com", token));

    /* Verify token is 64 hex chars */
    ASSERT_INT_EQ(64, (int)strlen(token));

    /* Verify token exists in database */
    int rc = sqlite3_prepare_v2(db,
        "SELECT email, used FROM auth_tokens WHERE token = ?",
        -1, &stmt, NULL);
    ASSERT_INT_EQ(SQLITE_OK, rc);

    sqlite3_bind_text(stmt, 1, token, -1, SQLITE_STATIC);
    rc = sqlite3_step(stmt);
    ASSERT_INT_EQ(SQLITE_ROW, rc);

    /* Email should match */
    const char *email = (const char *)sqlite3_column_text(stmt, 0);
    ASSERT_STR_EQ("test@example.com", email);

    /* Token should not be used yet */
    int used = sqlite3_column_int(stmt, 1);
    ASSERT_INT_EQ(0, used);

    sqlite3_finalize(stmt);

    /* Cleanup */
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'test@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Validate magic link creates session
 */
TEST(test_validate_magic_link) {
    char token[65], session[65];
    int64_t user_id;

    /* Create magic link */
    ASSERT_INT_EQ(0, auth_create_magic_link("validate@example.com", token));

    /* Validate it */
    ASSERT_INT_EQ(0, auth_validate_magic_link(token, session, &user_id));

    /* Should have created a user */
    ASSERT(user_id > 0);

    /* Session token should be valid */
    ASSERT_INT_EQ(64, (int)strlen(session));

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM sessions WHERE user_id IN "
                     "(SELECT id FROM users WHERE email = 'validate@example.com')",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'validate@example.com'",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'validate@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Magic link can only be used once
 */
TEST(test_magic_link_single_use) {
    char token[65], session1[65], session2[65];
    int64_t user_id;

    /* Create and use magic link */
    ASSERT_INT_EQ(0, auth_create_magic_link("single@example.com", token));
    ASSERT_INT_EQ(0, auth_validate_magic_link(token, session1, &user_id));

    /* Second use should fail */
    ASSERT_INT_EQ(-1, auth_validate_magic_link(token, session2, &user_id));

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM sessions WHERE user_id IN "
                     "(SELECT id FROM users WHERE email = 'single@example.com')",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'single@example.com'",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'single@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Invalid token is rejected
 */
TEST(test_invalid_token_rejected) {
    char session[65];
    int64_t user_id;

    /* Random invalid token should fail */
    ASSERT_INT_EQ(-1, auth_validate_magic_link("invalid_token_abc123", session, &user_id));

    return 1;
}

/*
 * Test: Get user from valid session
 */
TEST(test_get_user_from_session) {
    char token[65], session[65];
    int64_t user_id;
    User user;

    /* Create user and session */
    ASSERT_INT_EQ(0, auth_create_magic_link("session@example.com", token));
    ASSERT_INT_EQ(0, auth_validate_magic_link(token, session, &user_id));

    /* Get user from session */
    ASSERT_INT_EQ(0, auth_get_user_from_session(session, &user));

    /* Verify user info */
    ASSERT_STR_EQ("session@example.com", user.email);
    ASSERT_INT_EQ((int)user_id, (int)user.id);

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM sessions WHERE user_id IN "
                     "(SELECT id FROM users WHERE email = 'session@example.com')",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'session@example.com'",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'session@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Invalid session is rejected
 */
TEST(test_invalid_session_rejected) {
    User user;

    /* Random invalid session should fail */
    ASSERT_INT_EQ(-1, auth_get_user_from_session("not_a_real_session", &user));

    return 1;
}

/*
 * Test: Logout destroys session
 */
TEST(test_logout) {
    char token[65], session[65];
    int64_t user_id;
    User user;

    /* Create user and session */
    ASSERT_INT_EQ(0, auth_create_magic_link("logout@example.com", token));
    ASSERT_INT_EQ(0, auth_validate_magic_link(token, session, &user_id));

    /* Verify session works */
    ASSERT_INT_EQ(0, auth_get_user_from_session(session, &user));

    /* Logout */
    ASSERT_INT_EQ(0, auth_logout(session));

    /* Session should no longer work */
    ASSERT_INT_EQ(-1, auth_get_user_from_session(session, &user));

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'logout@example.com'",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'logout@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

/*
 * Test: Existing user gets same ID on re-login
 */
TEST(test_existing_user_login) {
    char token1[65], token2[65], session1[65], session2[65];
    int64_t user_id1, user_id2;

    /* First login creates user */
    ASSERT_INT_EQ(0, auth_create_magic_link("repeat@example.com", token1));
    ASSERT_INT_EQ(0, auth_validate_magic_link(token1, session1, &user_id1));

    /* Second login for same email */
    ASSERT_INT_EQ(0, auth_create_magic_link("repeat@example.com", token2));
    ASSERT_INT_EQ(0, auth_validate_magic_link(token2, session2, &user_id2));

    /* Should be same user ID */
    ASSERT_INT_EQ((int)user_id1, (int)user_id2);

    /* But different sessions */
    ASSERT(strcmp(session1, session2) != 0);

    /* Cleanup */
    sqlite3 *db = db_get();
    sqlite3_exec(db, "DELETE FROM sessions WHERE user_id IN "
                     "(SELECT id FROM users WHERE email = 'repeat@example.com')",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM auth_tokens WHERE email = 'repeat@example.com'",
                 NULL, NULL, NULL);
    sqlite3_exec(db, "DELETE FROM users WHERE email = 'repeat@example.com'",
                 NULL, NULL, NULL);

    return 1;
}

int main(void) {
    printf("Authentication Tests\n");
    printf("====================\n\n");

    /* Initialize database */
    const char *test_db = "test_auth.db";
    unlink(test_db);

    if (db_init(test_db) != 0) {
        fprintf(stderr, "Failed to initialize test database\n");
        return 1;
    }

    printf("\n");
    test_init();

    /* Utility tests */
    RUN_TEST(test_random_bytes);
    RUN_TEST(test_token_generation);
    RUN_TEST(test_token_uniqueness);
    RUN_TEST(test_token_buffer_too_small);

    /* Magic link tests */
    RUN_TEST(test_create_magic_link);
    RUN_TEST(test_validate_magic_link);
    RUN_TEST(test_magic_link_single_use);
    RUN_TEST(test_invalid_token_rejected);

    /* Session tests */
    RUN_TEST(test_get_user_from_session);
    RUN_TEST(test_invalid_session_rejected);
    RUN_TEST(test_logout);
    RUN_TEST(test_existing_user_login);

    int result = test_summary();

    db_close();
    unlink(test_db);

    return result;
}
