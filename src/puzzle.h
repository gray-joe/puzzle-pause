#ifndef PUZZLE_H
#define PUZZLE_H

#include <stdint.h>
#include <time.h>

typedef struct {
    int64_t id;
    char puzzle_date[16];
    char puzzle_type[16];
    char question[1024];
    char answer[256];       /* server-side only, never sent to client */
    char hint[512];
    int has_hint;
} Puzzle;

typedef struct {
    int64_t id;
    int64_t user_id;
    int64_t puzzle_id;
    int incorrect_guesses;
    int hint_used;
    int solved;
    int score;
    char completed_at[32];
} Attempt;

int puzzle_get_today(Puzzle *puzzle_out);
int puzzle_get_by_id(int64_t puzzle_id, Puzzle *puzzle_out);
int puzzle_get_archive(Puzzle *puzzles, int max, int *count);
int puzzle_get_attempt(int64_t user_id, int64_t puzzle_id, Attempt *attempt_out);

/* Returns 1 if correct, 0 if incorrect, -1 on error */
int puzzle_submit_guess(int64_t user_id, int64_t puzzle_id,
                        const char *guess, int *score_out);

int puzzle_reveal_hint(int64_t user_id, int64_t puzzle_id,
                       char *hint_out, size_t hint_size);

int puzzle_calculate_score(time_t solve_time, const char *puzzle_date,
                           int incorrect_guesses, int hint_used);

char *puzzle_normalize_answer(char *str);

#endif /* PUZZLE_H */
