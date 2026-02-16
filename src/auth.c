#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include "auth.h"
#include "db.h"
#include "util.h"
#include "sqlite3.h"

static int generate_short_code(char *out, size_t out_size) {
    static const char charset[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    static const int charset_len = 32;

    if (out == NULL || out_size < AUTH_CODE_LEN + 1)
        return -1;

    unsigned char bytes[AUTH_CODE_LEN];
    if (generate_random_bytes(bytes, sizeof(bytes)) != 0)
        return -1;

    for (int i = 0; i < AUTH_CODE_LEN; i++)
        out[i] = charset[bytes[i] % charset_len];
    out[AUTH_CODE_LEN] = '\0';

    return 0;
}

int auth_create_magic_link(const char *email, char *token_out, char *code_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;
    int rc;

    if (db == NULL || email == NULL || token_out == NULL || code_out == NULL)
        return -1;

    if (strlen(email) == 0 || strlen(email) > AUTH_MAX_EMAIL_LEN)
        return -1;

    if (generate_token_hex(token_out, 65, AUTH_TOKEN_BYTES) != 0)
        return -1;

    if (generate_short_code(code_out, AUTH_CODE_LEN + 1) != 0)
        return -1;

    char expires_at[32];
    long expiry = get_current_time() + AUTH_TOKEN_EXPIRY_SECS;
    format_datetime(expires_at, sizeof(expires_at), expiry);

    int64_t user_id = 0;
    const char *user_sql = "SELECT id FROM users WHERE email = ?";

    rc = sqlite3_prepare_v2(db, user_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, email, -1, SQLITE_STATIC);

    if (sqlite3_step(stmt) == SQLITE_ROW)
        user_id = sqlite3_column_int64(stmt, 0);
    sqlite3_finalize(stmt);

    const char *insert_sql =
        "INSERT INTO auth_tokens (user_id, email, token, short_code, expires_at) "
        "VALUES (?, ?, ?, ?, ?)";

    rc = sqlite3_prepare_v2(db, insert_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    if (user_id > 0)
        sqlite3_bind_int64(stmt, 1, user_id);
    else
        sqlite3_bind_null(stmt, 1);

    sqlite3_bind_text(stmt, 2, email, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, token_out, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 4, code_out, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 5, expires_at, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    return 0;
}

int auth_validate_magic_link(const char *token, char *session_out, int64_t *user_id_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;
    int rc;

    if (db == NULL || token == NULL || session_out == NULL || user_id_out == NULL)
        return -1;

    const char *lookup_sql =
        "SELECT id, user_id, email FROM auth_tokens "
        "WHERE token = ? AND used = 0 AND expires_at > datetime('now')";

    rc = sqlite3_prepare_v2(db, lookup_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, token, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    int64_t token_id = sqlite3_column_int64(stmt, 0);
    int64_t user_id = 0;
    char email[256] = {0};

    if (sqlite3_column_type(stmt, 1) != SQLITE_NULL)
        user_id = sqlite3_column_int64(stmt, 1);

    const char *email_text = (const char *)sqlite3_column_text(stmt, 2);
    if (email_text)
        strncpy(email, email_text, sizeof(email) - 1);

    sqlite3_finalize(stmt);

    /* New user registration */
    if (user_id == 0) {
        rc = sqlite3_prepare_v2(db, "INSERT INTO users (email) VALUES (?)", -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_text(stmt, 1, email, -1, SQLITE_STATIC);
        rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (rc != SQLITE_DONE)
            return -1;

        user_id = sqlite3_last_insert_rowid(db);
    }

    /* Mark token as used */
    rc = sqlite3_prepare_v2(db, "UPDATE auth_tokens SET used = 1 WHERE id = ?", -1, &stmt, NULL);
    if (rc == SQLITE_OK) {
        sqlite3_bind_int64(stmt, 1, token_id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    if (generate_token_hex(session_out, 65, SESSION_TOKEN_BYTES) != 0)
        return -1;

    char session_expires[32];
    long expiry = get_current_time() + SESSION_EXPIRY_SECS;
    format_datetime(session_expires, sizeof(session_expires), expiry);

    const char *session_sql =
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)";

    rc = sqlite3_prepare_v2(db, session_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_text(stmt, 2, session_out, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, session_expires, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    *user_id_out = user_id;
    return 0;
}

int auth_validate_code(const char *email, const char *code, char *session_out, int64_t *user_id_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;
    int rc;

    if (db == NULL || email == NULL || code == NULL || session_out == NULL || user_id_out == NULL)
        return -1;

    /* Case-insensitive code lookup: find unused, unexpired token for this email */
    const char *lookup_sql =
        "SELECT id, user_id, short_code, attempts FROM auth_tokens "
        "WHERE email = ? AND used = 0 AND expires_at > datetime('now') "
        "AND short_code IS NOT NULL "
        "ORDER BY id DESC LIMIT 1";

    rc = sqlite3_prepare_v2(db, lookup_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, email, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    int64_t token_id = sqlite3_column_int64(stmt, 0);
    int64_t user_id = 0;
    if (sqlite3_column_type(stmt, 1) != SQLITE_NULL)
        user_id = sqlite3_column_int64(stmt, 1);

    char stored_code[AUTH_CODE_LEN + 1] = {0};
    const char *code_text = (const char *)sqlite3_column_text(stmt, 2);
    if (code_text)
        strncpy(stored_code, code_text, AUTH_CODE_LEN);
    int attempts = sqlite3_column_int(stmt, 3);
    sqlite3_finalize(stmt);

    if (attempts >= AUTH_MAX_CODE_ATTEMPTS) {
        /* Too many failed attempts — invalidate */
        rc = sqlite3_prepare_v2(db, "UPDATE auth_tokens SET used = 1 WHERE id = ?", -1, &stmt, NULL);
        if (rc == SQLITE_OK) {
            sqlite3_bind_int64(stmt, 1, token_id);
            sqlite3_step(stmt);
            sqlite3_finalize(stmt);
        }
        return -1;
    }

    /* Case-insensitive comparison */
    int match = (stored_code[0] != '\0' && strlen(code) == AUTH_CODE_LEN);
    if (match) {
        for (int i = 0; i < AUTH_CODE_LEN; i++) {
            char a = code[i];
            char b = stored_code[i];
            if (a >= 'a' && a <= 'z') a -= 32;
            if (b >= 'a' && b <= 'z') b -= 32;
            if (a != b) { match = 0; break; }
        }
    }

    if (!match) {
        /* Increment attempt counter */
        rc = sqlite3_prepare_v2(db,
            "UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = ?",
            -1, &stmt, NULL);
        if (rc == SQLITE_OK) {
            sqlite3_bind_int64(stmt, 1, token_id);
            sqlite3_step(stmt);
            sqlite3_finalize(stmt);
        }
        return -1;
    }

    /* Code matches — mark as used */
    rc = sqlite3_prepare_v2(db, "UPDATE auth_tokens SET used = 1 WHERE id = ?", -1, &stmt, NULL);
    if (rc == SQLITE_OK) {
        sqlite3_bind_int64(stmt, 1, token_id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    /* New user registration */
    if (user_id == 0) {
        rc = sqlite3_prepare_v2(db, "INSERT INTO users (email) VALUES (?)", -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_text(stmt, 1, email, -1, SQLITE_STATIC);
        rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (rc != SQLITE_DONE)
            return -1;

        user_id = sqlite3_last_insert_rowid(db);
    }

    if (generate_token_hex(session_out, 65, SESSION_TOKEN_BYTES) != 0)
        return -1;

    char session_expires[32];
    long expiry = get_current_time() + SESSION_EXPIRY_SECS;
    format_datetime(session_expires, sizeof(session_expires), expiry);

    const char *session_sql =
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)";

    rc = sqlite3_prepare_v2(db, session_sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_text(stmt, 2, session_out, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, session_expires, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    *user_id_out = user_id;
    return 0;
}

int auth_get_user_from_session(const char *session_token, User *user_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || session_token == NULL || user_out == NULL)
        return -1;

    memset(user_out, 0, sizeof(User));

    const char *sql =
        "SELECT u.id, u.email, u.display_name "
        "FROM sessions s "
        "JOIN users u ON s.user_id = u.id "
        "WHERE s.token = ? AND s.expires_at > datetime('now')";

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, session_token, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    user_out->id = sqlite3_column_int64(stmt, 0);

    const char *email = (const char *)sqlite3_column_text(stmt, 1);
    if (email)
        strncpy(user_out->email, email, sizeof(user_out->email) - 1);

    const char *name = (const char *)sqlite3_column_text(stmt, 2);
    if (name)
        strncpy(user_out->display_name, name, sizeof(user_out->display_name) - 1);

    sqlite3_finalize(stmt);
    return 0;
}

int auth_logout(const char *session_token) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || session_token == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db, "DELETE FROM sessions WHERE token = ?", -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, session_token, -1, SQLITE_STATIC);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

int auth_update_display_name(int64_t user_id, const char *display_name) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || display_name == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db, "UPDATE users SET display_name = ? WHERE id = ?", -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, display_name, -1, SQLITE_STATIC);
    sqlite3_bind_int64(stmt, 2, user_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

int auth_is_admin(const char *email) {
    if (email == NULL || email[0] == '\0')
        return 0;

    const char *env = getenv("ADMIN_EMAILS");
    if (env == NULL || env[0] == '\0')
        return 0;

    char buf[1024];
    strncpy(buf, env, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    char *saveptr;
    char *tok = strtok_r(buf, ",", &saveptr);
    while (tok) {
        while (*tok == ' ') tok++;
        char *end = tok + strlen(tok) - 1;
        while (end > tok && *end == ' ') *end-- = '\0';

        if (strcasecmp(tok, email) == 0)
            return 1;

        tok = strtok_r(NULL, ",", &saveptr);
    }

    return 0;
}

void auth_cleanup_expired(void) {
    sqlite3 *db = db_get();

    sqlite3_exec(db,
        "DELETE FROM auth_tokens WHERE expires_at < datetime('now')",
        NULL, NULL, NULL);

    sqlite3_exec(db,
        "DELETE FROM sessions WHERE expires_at < datetime('now')",
        NULL, NULL, NULL);
}
