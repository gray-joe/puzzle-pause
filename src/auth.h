#ifndef AUTH_H
#define AUTH_H

#include <stdint.h>

#define AUTH_TOKEN_BYTES 32
#define AUTH_TOKEN_EXPIRY_SECS 900     /* 15 minutes */
#define SESSION_TOKEN_BYTES 32
#define SESSION_EXPIRY_SECS 2592000    /* 30 days */
#define AUTH_MAX_EMAIL_LEN 254         /* RFC 5321 */

typedef struct {
    int64_t id;
    char email[256];
    char display_name[256];
} User;

/* Returns 0 on success, -1 on failure for all functions below */
int auth_create_magic_link(const char *email, char *token_out);
int auth_validate_magic_link(const char *token, char *session_out, int64_t *user_id_out);
int auth_get_user_from_session(const char *session_token, User *user_out);
int auth_logout(const char *session_token);
int auth_update_display_name(int64_t user_id, const char *display_name);
void auth_cleanup_expired(void);

#endif /* AUTH_H */
