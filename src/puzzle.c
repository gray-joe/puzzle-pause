#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <time.h>
#include "puzzle.h"
#include "db.h"
#include "util.h"
#include "sqlite3.h"

int puzzle_parse_ladder(const char *question, LadderStep *steps, int max_steps) {
    if (!question || !steps || max_steps <= 0)
        return 0;

    int count = 0;
    const char *p = question;

    while (*p && count < max_steps) {
        while (*p == ' ') p++;
        if (*p == '\0') break;

        const char *end = strstr(p, ", ");
        size_t len;
        if (end)
            len = end - p;
        else
            len = strlen(p);

        /* Trim trailing spaces */
        while (len > 0 && p[len - 1] == ' ') len--;

        if (len == 0) {
            if (end)
                p = end + 2;
            else
                break;
            continue;
        }

        memset(&steps[count], 0, sizeof(LadderStep));

        if (len == 4 && memcmp(p, "____", 4) == 0) {
            steps[count].is_blank = 1;
        } else {
            if (len >= sizeof(steps[count].word))
                len = sizeof(steps[count].word) - 1;
            memcpy(steps[count].word, p, len);
            steps[count].word[len] = '\0';
        }

        count++;

        if (end)
            p = end + 2;
        else
            break;
    }

    return count;
}

int puzzle_parse_choice(const char *question, ChoicePuzzle *out) {
    if (!question || !out)
        return -1;

    memset(out, 0, sizeof(ChoicePuzzle));

    const char *delim = strchr(question, '|');
    if (!delim)
        return -1;

    size_t prompt_len = delim - question;
    if (prompt_len >= sizeof(out->prompt))
        prompt_len = sizeof(out->prompt) - 1;
    memcpy(out->prompt, question, prompt_len);
    out->prompt[prompt_len] = '\0';

    const char *p = delim + 1;
    while (*p && out->num_options < MAX_CHOICE_OPTIONS) {
        const char *next = strchr(p, '|');
        size_t len;
        if (next)
            len = next - p;
        else
            len = strlen(p);

        if (len == 0) {
            if (next) { p = next + 1; continue; }
            break;
        }

        if (len >= sizeof(out->options[0]))
            len = sizeof(out->options[0]) - 1;
        memcpy(out->options[out->num_options], p, len);
        out->options[out->num_options][len] = '\0';
        out->num_options++;

        if (next)
            p = next + 1;
        else
            break;
    }

    if (out->num_options < 2)
        return -1;

    return 0;
}

/* Before 09:00 UTC, show yesterday's puzzle */
static void get_puzzle_date(char *out, size_t out_size) {
    time_t now = (time_t)get_current_time();
    struct tm *tm = gmtime(&now);

    if (tm->tm_hour < 9)
        now -= 86400;

    tm = gmtime(&now);
    strftime(out, out_size, "%Y-%m-%d", tm);
}

static int populate_puzzle(sqlite3_stmt *stmt, Puzzle *p) {
    memset(p, 0, sizeof(Puzzle));

    p->id = sqlite3_column_int64(stmt, 0);

    const char *date = (const char *)sqlite3_column_text(stmt, 1);
    if (date) strncpy(p->puzzle_date, date, sizeof(p->puzzle_date) - 1);

    const char *type = (const char *)sqlite3_column_text(stmt, 2);
    if (type) strncpy(p->puzzle_type, type, sizeof(p->puzzle_type) - 1);

    const char *name = (const char *)sqlite3_column_text(stmt, 3);
    if (name) strncpy(p->puzzle_name, name, sizeof(p->puzzle_name) - 1);

    const char *question = (const char *)sqlite3_column_text(stmt, 4);
    if (question) strncpy(p->question, question, sizeof(p->question) - 1);

    const char *answer = (const char *)sqlite3_column_text(stmt, 5);
    if (answer) strncpy(p->answer, answer, sizeof(p->answer) - 1);

    const char *hint = (const char *)sqlite3_column_text(stmt, 6);
    if (hint && hint[0] != '\0') {
        strncpy(p->hint, hint, sizeof(p->hint) - 1);
        p->has_hint = 1;
    }

    return 0;
}

static const char *PUZZLE_SELECT =
    "SELECT id, puzzle_date, puzzle_type, puzzle_name, question, answer, hint FROM puzzles ";

int puzzle_get_today(Puzzle *puzzle_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || puzzle_out == NULL)
        return -1;

    char today[16];
    get_puzzle_date(today, sizeof(today));

    char sql[512];
    snprintf(sql, sizeof(sql), "%s WHERE puzzle_date = ?", PUZZLE_SELECT);

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    populate_puzzle(stmt, puzzle_out);
    sqlite3_finalize(stmt);
    return 0;
}

int puzzle_get_by_id(int64_t puzzle_id, Puzzle *puzzle_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || puzzle_out == NULL)
        return -1;

    char sql[512];
    snprintf(sql, sizeof(sql), "%s WHERE id = ?", PUZZLE_SELECT);

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, puzzle_id);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    populate_puzzle(stmt, puzzle_out);
    sqlite3_finalize(stmt);
    return 0;
}

int puzzle_get_archive(Puzzle *puzzles, int max, int *count, int include_future) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || puzzles == NULL || count == NULL)
        return -1;

    char today[16];
    get_puzzle_date(today, sizeof(today));

    char sql[512];
    if (include_future) {
        snprintf(sql, sizeof(sql),
            "%s ORDER BY puzzle_date ASC LIMIT ?",
            PUZZLE_SELECT);
    } else {
        snprintf(sql, sizeof(sql),
            "%s WHERE puzzle_date < ? ORDER BY puzzle_date DESC LIMIT ?",
            PUZZLE_SELECT);
    }

    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    if (include_future) {
        sqlite3_bind_int(stmt, 1, max);
    } else {
        sqlite3_bind_text(stmt, 1, today, -1, SQLITE_STATIC);
        sqlite3_bind_int(stmt, 2, max);
    }

    *count = 0;
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW && *count < max) {
        populate_puzzle(stmt, &puzzles[*count]);
        (*count)++;
    }

    sqlite3_finalize(stmt);
    return 0;
}

int puzzle_get_attempt(int64_t user_id, int64_t puzzle_id, Attempt *attempt_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || attempt_out == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db,
        "SELECT id, user_id, puzzle_id, incorrect_guesses, hint_used, "
        "       solved, score, completed_at "
        "FROM attempts WHERE user_id = ? AND puzzle_id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_int64(stmt, 2, puzzle_id);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    memset(attempt_out, 0, sizeof(Attempt));
    attempt_out->id = sqlite3_column_int64(stmt, 0);
    attempt_out->user_id = sqlite3_column_int64(stmt, 1);
    attempt_out->puzzle_id = sqlite3_column_int64(stmt, 2);
    attempt_out->incorrect_guesses = sqlite3_column_int(stmt, 3);
    attempt_out->hint_used = sqlite3_column_int(stmt, 4);
    attempt_out->solved = sqlite3_column_int(stmt, 5);
    attempt_out->score = sqlite3_column_int(stmt, 6);

    const char *completed = (const char *)sqlite3_column_text(stmt, 7);
    if (completed)
        strncpy(attempt_out->completed_at, completed, sizeof(attempt_out->completed_at) - 1);

    sqlite3_finalize(stmt);
    return 0;
}

/* Creates attempt record if one doesn't exist, returns attempt ID */
static int64_t ensure_attempt_exists(int64_t user_id, int64_t puzzle_id) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    Attempt existing;
    if (puzzle_get_attempt(user_id, puzzle_id, &existing) == 0)
        return existing.id;

    int rc = sqlite3_prepare_v2(db,
        "INSERT INTO attempts (user_id, puzzle_id, incorrect_guesses, hint_used, solved) "
        "VALUES (?, ?, 0, 0, 0)",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    sqlite3_bind_int64(stmt, 2, puzzle_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        return -1;

    return sqlite3_last_insert_rowid(db);
}

char *puzzle_normalize_answer(char *str) {
    if (str == NULL || str[0] == '\0')
        return str;

    char *read = str;
    char *write = str;

    while (*read && isspace((unsigned char)*read))
        read++;

    int last_was_space = 0;
    while (*read) {
        if (isspace((unsigned char)*read)) {
            if (!last_was_space) {
                *write++ = ' ';
                last_was_space = 1;
            }
        } else if (*read == ',' || *read == '-' || *read == '>') {
            /* Treat separators as spaces for flexible answer matching */
            if (!last_was_space) {
                *write++ = ' ';
                last_was_space = 1;
            }
        } else {
            *write++ = tolower((unsigned char)*read);
            last_was_space = 0;
        }
        read++;
    }

    if (write > str && *(write - 1) == ' ')
        write--;

    *write = '\0';
    return str;
}

static int check_answer(const char *guess, const char *answer) {
    char guess_norm[256];
    strncpy(guess_norm, guess, sizeof(guess_norm) - 1);
    guess_norm[sizeof(guess_norm) - 1] = '\0';
    puzzle_normalize_answer(guess_norm);

    /* Support pipe-separated alternative answers */
    char answers_buf[1024];
    strncpy(answers_buf, answer, sizeof(answers_buf) - 1);
    answers_buf[sizeof(answers_buf) - 1] = '\0';

    char *saveptr;
    char *alt = strtok_r(answers_buf, "|", &saveptr);
    while (alt) {
        char alt_norm[256];
        strncpy(alt_norm, alt, sizeof(alt_norm) - 1);
        alt_norm[sizeof(alt_norm) - 1] = '\0';
        puzzle_normalize_answer(alt_norm);
        if (strcmp(guess_norm, alt_norm) == 0)
            return 1;
        alt = strtok_r(NULL, "|", &saveptr);
    }
    return 0;
}

int puzzle_calculate_score(time_t solve_time, const char *puzzle_date,
                           int incorrect_guesses, int hint_used) {
    struct tm release_tm = {0};
    int year, month, day;

    if (sscanf(puzzle_date, "%d-%d-%d", &year, &month, &day) != 3)
        return 10;

    release_tm.tm_year = year - 1900;
    release_tm.tm_mon = month - 1;
    release_tm.tm_mday = day;
    release_tm.tm_hour = 9;  /* 09:00 UTC release */

    /* timegm is not standard C but available on macOS/Linux */
    time_t release_time = timegm(&release_tm);

    double diff_seconds = difftime(solve_time, release_time);
    if (diff_seconds < 0)
        diff_seconds = 0;

    int minutes = (int)(diff_seconds / 60);

    int base_score;
    if (minutes <= 10)
        base_score = 100;
    else if (minutes <= 30)
        base_score = 90;
    else if (minutes <= 60)
        base_score = 80;
    else if (minutes <= 120)
        base_score = 75;
    else if (minutes <= 180)
        base_score = 70;
    else {
        int extra_hours = (minutes - 180) / 60;
        base_score = 70 - (5 * extra_hours);
    }

    int score = base_score;
    score -= incorrect_guesses * 5;
    if (hint_used)
        score -= 10;

    if (score < 10)
        score = 10;

    return score;
}

int puzzle_submit_guess(int64_t user_id, int64_t puzzle_id,
                        const char *guess, int *score_out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || guess == NULL)
        return -1;

    int rc = sqlite3_prepare_v2(db,
        "SELECT answer, puzzle_date FROM puzzles WHERE id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, puzzle_id);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    char answer[256] = {0};
    char puzzle_date[16] = {0};

    const char *ans = (const char *)sqlite3_column_text(stmt, 0);
    if (ans) strncpy(answer, ans, sizeof(answer) - 1);

    const char *pdate = (const char *)sqlite3_column_text(stmt, 1);
    if (pdate) strncpy(puzzle_date, pdate, sizeof(puzzle_date) - 1);

    sqlite3_finalize(stmt);

    int64_t attempt_id = ensure_attempt_exists(user_id, puzzle_id);
    if (attempt_id < 0)
        return -1;

    Attempt attempt;
    if (puzzle_get_attempt(user_id, puzzle_id, &attempt) != 0)
        return -1;

    if (attempt.solved) {
        if (score_out) *score_out = attempt.score;
        return 1;
    }

    if (check_answer(guess, answer)) {
        time_t now = (time_t)get_current_time();
        int score = puzzle_calculate_score(now, puzzle_date,
                                           attempt.incorrect_guesses,
                                           attempt.hint_used);

        char completed_at[32];
        format_datetime(completed_at, sizeof(completed_at), (long)now);

        rc = sqlite3_prepare_v2(db,
            "UPDATE attempts SET solved = 1, score = ?, completed_at = ? "
            "WHERE id = ?",
            -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_int(stmt, 1, score);
        sqlite3_bind_text(stmt, 2, completed_at, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt, 3, attempt_id);

        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (score_out) *score_out = score;
        return 1;
    } else {
        rc = sqlite3_prepare_v2(db,
            "UPDATE attempts SET incorrect_guesses = incorrect_guesses + 1 "
            "WHERE id = ?",
            -1, &stmt, NULL);
        if (rc == SQLITE_OK) {
            sqlite3_bind_int64(stmt, 1, attempt_id);
            sqlite3_step(stmt);
            sqlite3_finalize(stmt);
        }

        return 0;
    }
}

int puzzle_reveal_hint(int64_t user_id, int64_t puzzle_id,
                       char *hint_out, size_t hint_size) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || hint_out == NULL || hint_size == 0)
        return -1;

    int rc = sqlite3_prepare_v2(db,
        "SELECT hint FROM puzzles WHERE id = ?",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, puzzle_id);

    rc = sqlite3_step(stmt);
    if (rc != SQLITE_ROW) {
        sqlite3_finalize(stmt);
        return -1;
    }

    const char *hint = (const char *)sqlite3_column_text(stmt, 0);
    if (hint == NULL || hint[0] == '\0') {
        sqlite3_finalize(stmt);
        return -1;
    }

    strncpy(hint_out, hint, hint_size - 1);
    hint_out[hint_size - 1] = '\0';
    sqlite3_finalize(stmt);

    int64_t attempt_id = ensure_attempt_exists(user_id, puzzle_id);
    if (attempt_id < 0)
        return -1;

    rc = sqlite3_prepare_v2(db,
        "UPDATE attempts SET hint_used = 1 WHERE id = ?",
        -1, &stmt, NULL);
    if (rc == SQLITE_OK) {
        sqlite3_bind_int64(stmt, 1, attempt_id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    return 0;
}

int puzzle_get_user_stats(int64_t user_id, UserStats *out) {
    sqlite3 *db = db_get();
    sqlite3_stmt *stmt = NULL;

    if (db == NULL || out == NULL)
        return -1;

    memset(out, 0, sizeof(UserStats));
    out->daily_score = -1;

    /* All-time total + average + puzzles solved */
    int rc = sqlite3_prepare_v2(db,
        "SELECT COALESCE(SUM(score), 0), COUNT(*), COALESCE(AVG(score), 0) "
        "FROM attempts WHERE user_id = ? AND solved = 1",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        out->alltime_total = sqlite3_column_int(stmt, 0);
        out->puzzles_solved = sqlite3_column_int(stmt, 1);
        out->average_score = sqlite3_column_int(stmt, 2);
    }
    sqlite3_finalize(stmt);

    /* Weekly total */
    rc = sqlite3_prepare_v2(db,
        "SELECT COALESCE(SUM(a.score), 0) "
        "FROM attempts a JOIN puzzles p ON a.puzzle_id = p.id "
        "WHERE a.user_id = ? AND a.solved = 1 "
        "AND p.puzzle_date >= date('now', 'weekday 0', '-6 days') "
        "AND p.puzzle_date <= date('now')",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    if (sqlite3_step(stmt) == SQLITE_ROW)
        out->weekly_total = sqlite3_column_int(stmt, 0);
    sqlite3_finalize(stmt);

    /* Daily score */
    rc = sqlite3_prepare_v2(db,
        "SELECT a.score FROM attempts a JOIN puzzles p ON a.puzzle_id = p.id "
        "WHERE a.user_id = ? AND a.solved = 1 AND p.puzzle_date = date('now')",
        -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return -1;

    sqlite3_bind_int64(stmt, 1, user_id);
    if (sqlite3_step(stmt) == SQLITE_ROW)
        out->daily_score = sqlite3_column_int(stmt, 0);
    sqlite3_finalize(stmt);

    /* Global percentile */
    if (out->puzzles_solved > 0) {
        rc = sqlite3_prepare_v2(db,
            "WITH user_totals AS ("
            "  SELECT user_id, SUM(score) as total "
            "  FROM attempts WHERE solved = 1 GROUP BY user_id"
            ") SELECT "
            "  COUNT(CASE WHEN total >= (SELECT total FROM user_totals WHERE user_id = ?) THEN 1 END),"
            "  COUNT(*) "
            "FROM user_totals",
            -1, &stmt, NULL);
        if (rc != SQLITE_OK)
            return -1;

        sqlite3_bind_int64(stmt, 1, user_id);
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int at_or_above = sqlite3_column_int(stmt, 0);
            int total_users = sqlite3_column_int(stmt, 1);
            if (total_users > 0)
                out->percentile = (at_or_above * 100) / total_users;
            else
                out->percentile = 100;
        }
        sqlite3_finalize(stmt);
    }

    return 0;
}
