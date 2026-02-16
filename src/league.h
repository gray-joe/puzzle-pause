#ifndef LEAGUE_H
#define LEAGUE_H

#include <stdint.h>

typedef struct {
    int64_t id;
    char name[256];
    char invite_code[8];
    int64_t creator_id;
    int member_count;
} League;

typedef struct {
    int64_t user_id;
    char display_name[256];
    char email[256];
    int score;              /* -1 = not solved (daily) */
    int rank;
} LeaderboardEntry;

/* Returns league ID (>0) on success, -1 on failure */
int64_t league_create(int64_t creator_id, const char *name, char *invite_code_out);

/* Returns 0 on success, -1 on failure */
int league_get(int64_t league_id, League *out);
int league_get_by_code(const char *code, League *out);
int league_join(int64_t league_id, int64_t user_id);
int league_leave(int64_t league_id, int64_t user_id);
int league_delete(int64_t league_id, int64_t user_id);
int league_get_user_leagues(int64_t user_id, League *leagues, int max, int *count);

/* Returns 1 if member, 0 if not */
int league_is_member(int64_t league_id, int64_t user_id);

typedef struct {
    int64_t guesser_id;
    int64_t one_shotter_id;
    int64_t early_riser_id;
    int64_t hint_lover_id;
} LeagueTags;

int league_get_tags(int64_t league_id, LeagueTags *tags);

/* Leaderboard queries - entries sorted by score desc, with rank assigned */
int league_get_leaderboard_today(int64_t league_id, LeaderboardEntry *entries,
                                  int max, int *count);
int league_get_leaderboard_weekly(int64_t league_id, LeaderboardEntry *entries,
                                   int max, int *count);
int league_get_leaderboard_alltime(int64_t league_id, LeaderboardEntry *entries,
                                    int max, int *count);

#endif /* LEAGUE_H */
