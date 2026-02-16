#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include "league.h"
#include "db.h"
#include "util.h"
#include "sqlite3.h"

static int generate_invite_code(char *out, size_t out_size) {
    if (out_size < 7)
        return -1;

    if (generate_token_hex(out, out_size, 3) != 0)
        return -1;

    for (int i = 0; i < 6; i++)
        out[i] = toupper((unsigned char)out[i]);

    return 0;
}

int64_t league_create(int64_t creator_id, const char *name, char *invite_code_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    int rc;

    if (db == NULL || name == NULL || invite_code_out == NULL)
        return -1;

    char invite_code[8];
    int attempts = 0;
    do {
        if (generate_invite_code(invite_code, sizeof(invite_code)) != 0)
            return -1;

        rc = sqlite3_prepare_v2(db,
            "SELECT id FROM leagues WHERE invite_code = ?",
            -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_text(stmt, 1, invite_code, -1, SQLITE_STATIC);
        rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);
        attempts++;
    } while (rc == SQLITE_ROW && attempts < 10);

    if (rc == SQLITE_ROW)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "INSERT INTO leagues (name, invite_code, creator_id) VALUES (?, ?, ?)",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, name, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, invite_code, -1, SQLITE_STATIC);
    sqlite3_bind_int64(stmt, 3, creator_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    int64_t league_id = sqlite3_last_insert_rowid(db);

    rc = sqlite3_prepare_v2(db,
        "INSERT INTO league_members (league_id, user_id) VALUES (?, ?)",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        char cleanup_sql[128];
        snprintf(cleanup_sql, sizeof(cleanup_sql),
                 "DELETE FROM leagues WHERE id = %lld", (long long)league_id);
        sqlite3_exec(db, cleanup_sql, NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_int64(stmt, 1, league_id);
    sqlite3_bind_int64(stmt, 2, creator_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        char sql[128];
        snprintf(sql, sizeof(sql), "DELETE FROM leagues WHERE id = %lld",
                 (long long)league_id);
        sqlite3_exec(db, sql, NULL, NULL, NULL);
        return -1;
    }

    strncpy(invite_code_out, invite_code, 7);
    invite_code_out[6] = '\0';

    return league_id;
}

static int populate_league(sqlite3_stmt *stmt, League *out) {
    out->id = sqlite3_column_int64(stmt, 0);

    const char *name = (const char *)sqlite3_column_text(stmt, 1);
    if (name) {
        strncpy(out->name, name, sizeof(out->name) - 1);
        out->name[sizeof(out->name) - 1] = '\0';
    }

    const char *code = (const char *)sqlite3_column_text(stmt, 2);
    if (code) {
        strncpy(out->invite_code, code, sizeof(out->invite_code) - 1);
        out->invite_code[sizeof(out->invite_code) - 1] = '\0';
    }

    out->creator_id = sqlite3_column_int64(stmt, 3);
    out->member_count = sqlite3_column_int(stmt, 4);
    return 0;
}

static const char *LEAGUE_SELECT =
    "SELECT l.id, l.name, l.invite_code, l.creator_id, "
    "  (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count "
    "FROM leagues l ";

int league_get(int64_t league_id, League *out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    if (db == NULL || out == NULL)
        return -1;

    memset(out, 0, sizeof(League));

    char sql[512];
    snprintf(sql, sizeof(sql), "%s WHERE l.id = ?", LEAGUE_SELECT);

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    rc = sqlite3_step(stmt);

    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    populate_league(stmt, out);
    sqlite3_finalize(stmt);
    return 0;
}

int league_get_by_code(const char *code, League *out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    if (db == NULL || code == NULL || out == NULL)
        return -1;

    memset(out, 0, sizeof(League));

    char upper_code[8];
    int i;
    for (i = 0; code[i] && i < 6; i++)
        upper_code[i] = toupper((unsigned char)code[i]);
    upper_code[i] = '\0';

    char sql[512];
    snprintf(sql, sizeof(sql), "%s WHERE l.invite_code = ?", LEAGUE_SELECT);

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, upper_code, -1, SQLITE_STATIC);
    rc = sqlite3_step(stmt);

    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    populate_league(stmt, out);
    sqlite3_finalize(stmt);
    return 0;
}

int league_join(int64_t league_id, int64_t user_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    int rc;

    if (db == NULL)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "SELECT id FROM leagues WHERE id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_ROW)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "INSERT INTO league_members (league_id, user_id) VALUES (?, ?)",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    sqlite3_bind_int64(stmt, 2, user_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

int league_leave(int64_t league_id, int64_t user_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    int rc;

    if (db == NULL)
        return -1;

    if (!league_is_member(league_id, user_id))
        return -1;

    League league;
    if (league_get(league_id, &league) != 0)
        return -1;

    /* Last member leaving — delete the league */
    if (league.member_count == 1)
        return league_delete(league_id, user_id);

    /* Creator leaving — transfer ownership to longest-standing member */
    if (league.creator_id == user_id) {
        rc = sqlite3_prepare_v2(db,
            "SELECT user_id FROM league_members "
            "WHERE league_id = ? AND user_id != ? "
            "ORDER BY joined_at ASC LIMIT 1",
            -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_int64(stmt, 1, league_id);
        sqlite3_bind_int64(stmt, 2, user_id);
        rc = sqlite3_step(stmt);

        if (rc != SQLITE_ROW) {
            sqlite3_finalize(stmt);
            return -1;
        }

        int64_t new_creator_id = sqlite3_column_int64(stmt, 0);
        sqlite3_finalize(stmt);

        rc = sqlite3_prepare_v2(db,
            "UPDATE leagues SET creator_id = ? WHERE id = ?",
            -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_int64(stmt, 1, new_creator_id);
        sqlite3_bind_int64(stmt, 2, league_id);
        rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (rc != SQLITE_DONE)
            return -1;
    }

    rc = sqlite3_prepare_v2(db,
        "DELETE FROM league_members WHERE league_id = ? AND user_id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    sqlite3_bind_int64(stmt, 2, user_id);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

int league_delete(int64_t league_id, int64_t user_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;
    int rc;

    if (db == NULL)
        return -1;

    League league;
    if (league_get(league_id, &league) != 0)
        return -1;

    if (league.creator_id != user_id)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "DELETE FROM league_members WHERE league_id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "DELETE FROM leagues WHERE id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_DONE) ? 0 : -1;
}

int league_is_member(int64_t league_id, int64_t user_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    if (db == NULL)
        return 0;

    int rc = sqlite3_prepare_v2(db,
        "SELECT 1 FROM league_members WHERE league_id = ? AND user_id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return 0;

    sqlite3_bind_int64(stmt, 1, league_id);
    sqlite3_bind_int64(stmt, 2, user_id);
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return (rc == SQLITE_ROW) ? 1 : 0;
}

int league_get_user_leagues(int64_t user_id, League *leagues, int max, int *count) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    if (db == NULL || leagues == NULL || count == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db,
        "SELECT l.id, l.name, l.invite_code, l.creator_id, "
        "  (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count "
        "FROM leagues l "
        "JOIN league_members lm ON l.id = lm.league_id "
        "WHERE lm.user_id = ? "
        "ORDER BY lm.joined_at DESC",
        -1, &stmt, NULL);

    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);

    *count = 0;
    while (*count < max && (rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        League *l = &leagues[*count];
        memset(l, 0, sizeof(League));
        populate_league(stmt, l);
        (*count)++;
    }

    sqlite3_finalize(stmt);
    return 0;
}

static int64_t query_tag_winner(sqlite3 *db, int64_t league_id, const char *sql) {
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);
    rc = sqlite3_step(stmt);

    int64_t result = -1;
    if (rc == SQLITE_ROW)
        result = sqlite3_column_int64(stmt, 0);

    sqlite3_finalize(stmt);
    return result;
}

int league_get_tags(int64_t league_id, LeagueTags *tags) {
    sqlite3 *db = db_get();
    if (db == NULL || tags == NULL)
        return -1;

    tags->guesser_id = query_tag_winner(db, league_id,
        "SELECT lm.user_id FROM league_members lm "
        "JOIN attempts a ON a.user_id = lm.user_id "
        "WHERE lm.league_id = ? AND a.incorrect_guesses > 0 "
        "GROUP BY lm.user_id ORDER BY SUM(a.incorrect_guesses) DESC LIMIT 1");

    tags->one_shotter_id = query_tag_winner(db, league_id,
        "SELECT lm.user_id FROM league_members lm "
        "JOIN attempts a ON a.user_id = lm.user_id "
        "WHERE lm.league_id = ? AND a.solved = 1 "
        "GROUP BY lm.user_id HAVING COUNT(*) >= 3 "
        "ORDER BY (CAST(SUM(CASE WHEN a.incorrect_guesses = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) DESC, "
        "COUNT(*) DESC LIMIT 1");

    tags->early_riser_id = query_tag_winner(db, league_id,
        "SELECT lm.user_id FROM league_members lm "
        "JOIN attempts a ON a.user_id = lm.user_id "
        "WHERE lm.league_id = ? AND a.solved = 1 AND a.completed_at IS NOT NULL "
        "GROUP BY lm.user_id HAVING COUNT(*) >= 3 "
        "ORDER BY AVG(CAST(strftime('%H', a.completed_at) AS INTEGER) * 3600 + "
        "CAST(strftime('%M', a.completed_at) AS INTEGER) * 60 + "
        "CAST(strftime('%S', a.completed_at) AS INTEGER)) ASC LIMIT 1");

    tags->hint_lover_id = query_tag_winner(db, league_id,
        "SELECT lm.user_id FROM league_members lm "
        "JOIN attempts a ON a.user_id = lm.user_id "
        "WHERE lm.league_id = ? AND a.hint_used = 1 "
        "GROUP BY lm.user_id ORDER BY SUM(a.hint_used) DESC LIMIT 1");

    return 0;
}

static void assign_ranks(LeaderboardEntry *entries, int count) {
    if (count == 0) return;

    int rank = 1;
    entries[0].rank = rank;

    for (int i = 1; i < count; i++) {
        if (entries[i].score != entries[i-1].score)
            rank = i + 1;
        entries[i].rank = rank;
    }
}

static void populate_leaderboard_entry(sqlite3_stmt *stmt, LeaderboardEntry *e) {
    e->user_id = sqlite3_column_int64(stmt, 0);

    const char *display = (const char *)sqlite3_column_text(stmt, 1);
    const char *email = (const char *)sqlite3_column_text(stmt, 2);

    if (display && display[0])
        strncpy(e->display_name, display, sizeof(e->display_name) - 1);
    else if (email)
        strncpy(e->display_name, email, sizeof(e->display_name) - 1);
    e->display_name[sizeof(e->display_name) - 1] = '\0';

    if (email) {
        strncpy(e->email, email, sizeof(e->email) - 1);
        e->email[sizeof(e->email) - 1] = '\0';
    }

    e->score = sqlite3_column_int(stmt, 3);
    e->rank = 0;
}

static int run_leaderboard_query(int64_t league_id, const char *sql,
                                  LeaderboardEntry *entries, int max, int *count) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt;

    if (db == NULL || entries == NULL || count == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, league_id);

    *count = 0;
    while (*count < max && (rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        memset(&entries[*count], 0, sizeof(LeaderboardEntry));
        populate_leaderboard_entry(stmt, &entries[*count]);
        (*count)++;
    }

    sqlite3_finalize(stmt);
    assign_ranks(entries, *count);
    return 0;
}

int league_get_leaderboard_today(int64_t league_id, LeaderboardEntry *entries,
                                  int max, int *count) {
    return run_leaderboard_query(league_id,
        "SELECT u.id, u.display_name, u.email, COALESCE(a.score, -1) as score "
        "FROM league_members lm "
        "JOIN users u ON lm.user_id = u.id "
        "LEFT JOIN puzzles p ON p.puzzle_date = date('now') "
        "LEFT JOIN attempts a ON a.user_id = u.id AND a.puzzle_id = p.id AND a.solved = 1 "
        "WHERE lm.league_id = ? "
        "ORDER BY "
        "  CASE WHEN a.score IS NULL THEN 1 ELSE 0 END, "  /* unsolved last */
        "  COALESCE(a.score, 0) DESC, "
        "  COALESCE(u.display_name, u.email) ASC",
        entries, max, count);
}

int league_get_leaderboard_weekly(int64_t league_id, LeaderboardEntry *entries,
                                   int max, int *count) {
    return run_leaderboard_query(league_id,
        "SELECT u.id, u.display_name, u.email, COALESCE(SUM(a.score), 0) as total_score "
        "FROM league_members lm "
        "JOIN users u ON lm.user_id = u.id "
        "LEFT JOIN attempts a ON a.user_id = u.id AND a.solved = 1 "
        "LEFT JOIN puzzles p ON a.puzzle_id = p.id "
        "  AND p.puzzle_date >= date('now', 'weekday 0', '-6 days') "
        "  AND p.puzzle_date <= date('now') "
        "WHERE lm.league_id = ? "
        "GROUP BY u.id "
        "ORDER BY total_score DESC, COALESCE(u.display_name, u.email) ASC",
        entries, max, count);
}

int league_get_leaderboard_alltime(int64_t league_id, LeaderboardEntry *entries,
                                    int max, int *count) {
    return run_leaderboard_query(league_id,
        "SELECT u.id, u.display_name, u.email, COALESCE(SUM(a.score), 0) as total_score "
        "FROM league_members lm "
        "JOIN users u ON lm.user_id = u.id "
        "LEFT JOIN attempts a ON a.user_id = u.id AND a.solved = 1 "
        "WHERE lm.league_id = ? "
        "GROUP BY u.id "
        "ORDER BY total_score DESC, COALESCE(u.display_name, u.email) ASC",
        entries, max, count);
}
