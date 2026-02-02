#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include "mongoose.h"
#include "db.h"
#include "auth.h"
#include "puzzle.h"
#include "league.h"

/* Rate limiting: 5 login attempts per minute per IP */
#define RATE_LIMIT_WINDOW_SECS 60
#define RATE_LIMIT_MAX_ATTEMPTS 5
#define RATE_LIMIT_MAX_IPS 1000

typedef struct {
    char ip[64];
    time_t window_start;
    int attempts;
} RateLimitEntry;

static RateLimitEntry rate_limit_table[RATE_LIMIT_MAX_IPS];
static int rate_limit_count = 0;

/* Returns 1 if allowed, 0 if rate limited. Increments counter. */
static int rate_limit_check(const char *ip) {
    time_t now = time(NULL);

    for (int i = 0; i < rate_limit_count; i++) {
        if (strcmp(rate_limit_table[i].ip, ip) == 0) {
            if (now - rate_limit_table[i].window_start >= RATE_LIMIT_WINDOW_SECS) {
                rate_limit_table[i].window_start = now;
                rate_limit_table[i].attempts = 1;
                return 1;
            }
            if (rate_limit_table[i].attempts >= RATE_LIMIT_MAX_ATTEMPTS)
                return 0;
            rate_limit_table[i].attempts++;
            return 1;
        }
    }

    if (rate_limit_count < RATE_LIMIT_MAX_IPS) {
        strncpy(rate_limit_table[rate_limit_count].ip, ip,
                sizeof(rate_limit_table[rate_limit_count].ip) - 1);
        rate_limit_table[rate_limit_count].window_start = now;
        rate_limit_table[rate_limit_count].attempts = 1;
        rate_limit_count++;
    }
    /* Table full — fail open */
    return 1;
}

static const char *TERMINAL_CSS =
    "<style>\n"
    "  * { box-sizing: border-box; }\n"
    "  body {\n"
    "    background: #15191e;\n"
    "    color: #e0e0e0;\n"
    "    font-family: Monaco, 'Cascadia Code', 'Fira Code', Consolas, monospace;\n"
    "    font-size: 14px;\n"
    "    line-height: 1.7;\n"
    "    max-width: 600px;\n"
    "    margin: 0 auto;\n"
    "    padding: 20px;\n"
    "    min-height: 100vh;\n"
    "  }\n"
    /* Header */
    "  .page-header {\n"
    "    margin-bottom: 10px;\n"
    "  }\n"
    "  .page-title {\n"
    "    font-size: 1.5em;\n"
    "    color: #e0e0e0;\n"
    "    margin: 0 0 10px 0;\n"
    "  }\n"
    "  .page-title .gt { color: #4ecca3; }\n"
    /* Nav */
    "  .nav {\n"
    "    margin-bottom: 15px;\n"
    "  }\n"
    "  .nav a {\n"
    "    color: #e0e0e0;\n"
    "    text-decoration: none;\n"
    "    margin-right: 20px;\n"
    "  }\n"
    "  .nav a:hover { color: #ffffff; }\n"
    "  .nav a.active { color: #4ecca3; }\n"
    "  .nav .gt { color: #ff9f43; }\n"
    "  .nav a.active .gt { color: #4ecca3; }\n"
    "  .nav-line {\n"
    "    border: none;\n"
    "    border-top: 1px solid #3a3a3a;\n"
    "    margin: 15px 0;\n"
    "  }\n"
    /* Content */
    "  .content-meta {\n"
    "    color: #808080;\n"
    "    margin-bottom: 15px;\n"
    "  }\n"
    /* Puzzle box */
    "  .puzzle-box {\n"
    "    border: 2px solid #3a3a3a;\n"
    "    border-radius: 15px;\n"
    "    padding: 40px 30px;\n"
    "    margin: 20px 0;\n"
    "    min-height: 200px;\n"
    "    display: flex;\n"
    "    align-items: center;\n"
    "    justify-content: center;\n"
    "    text-align: center;\n"
    "  }\n"
    /* Buttons */
    "  .action-btn {\n"
    "    display: block;\n"
    "    width: 100%;\n"
    "    background: transparent;\n"
    "    border: 2px solid #3a3a3a;\n"
    "    border-radius: 10px;\n"
    "    padding: 15px 20px;\n"
    "    margin: 10px 0;\n"
    "    color: #e0e0e0;\n"
    "    font-family: inherit;\n"
    "    font-size: inherit;\n"
    "    text-align: left;\n"
    "    cursor: pointer;\n"
    "    text-decoration: none;\n"
    "  }\n"
    "  .action-btn:hover {\n"
    "    border-color: #4ecca3;\n"
    "  }\n"
    "  .action-btn .gt { color: #4ecca3; margin-right: 15px; }\n"
    "  .action-btn.secondary .gt { color: #ff9f43; }\n"
    "  .action-btn input {\n"
    "    background: transparent;\n"
    "    border: none;\n"
    "    color: #e0e0e0;\n"
    "    font-family: inherit;\n"
    "    font-size: inherit;\n"
    "    width: calc(100% - 30px);\n"
    "    padding: 0;\n"
    "    margin: 0;\n"
    "  }\n"
    "  .action-btn input:focus { outline: none; }\n"
    "  .action-btn input::placeholder { color: #606060; }\n"
    /* Typography */
    "  h1, h2, h3 {\n"
    "    color: #e0e0e0;\n"
    "    font-family: inherit;\n"
    "    font-weight: normal;\n"
    "    margin-top: 0;\n"
    "  }\n"
    "  h1 .gt, h2 .gt { color: #4ecca3; }\n"
    "  a {\n"
    "    color: #e0e0e0;\n"
    "    text-decoration: none;\n"
    "  }\n"
    "  a:hover { color: #ffffff; }\n"
    "  a .gt { color: #ff9f43; }\n"
    "  .back-link { margin-bottom: 15px; display: block; }\n"
    "  .back-link .gt { color: #ff9f43; }\n"
    /* Forms */
    "  input, button {\n"
    "    background: #15191e;\n"
    "    color: #e0e0e0;\n"
    "    border: 1px solid #3a3a3a;\n"
    "    padding: 10px 15px;\n"
    "    font-family: inherit;\n"
    "    font-size: inherit;\n"
    "    margin: 5px 5px 5px 0;\n"
    "  }\n"
    "  input:focus {\n"
    "    outline: none;\n"
    "    border-color: #4ecca3;\n"
    "  }\n"
    "  input::placeholder { color: #505050; }\n"
    "  button {\n"
    "    cursor: pointer;\n"
    "  }\n"
    "  button:hover {\n"
    "    border-color: #4ecca3;\n"
    "  }\n"
    /* Status */
    "  .success { color: #4ecca3; }\n"
    "  .error { color: #ff6b6b; }\n"
    "  .muted { color: #606060; }\n"
    /* Tables */
    "  table {\n"
    "    width: 100%;\n"
    "    border-collapse: collapse;\n"
    "    margin: 20px 0;\n"
    "  }\n"
    "  th, td {\n"
    "    padding: 10px;\n"
    "    text-align: left;\n"
    "  }\n"
    "  th { color: #808080; }\n"
    "  td .gt { color: #4ecca3; }\n"
    /* List rows */
    "  .list-row {\n"
    "    padding: 8px 0;\n"
    "  }\n"
    "  .list-row .gt { color: #4ecca3; }\n"
    "  .list-row a { color: #e0e0e0; }\n"
    "  .list-row a:hover { color: #ffffff; }\n"
    "</style>\n";

static int method_is(struct mg_http_message *hm, const char *method) {
    return mg_strcmp(hm->method, mg_str(method)) == 0;
}

static int get_form_var(struct mg_http_message *hm, const char *name,
                        char *buf, size_t buf_size) {
    return mg_http_get_var(&hm->body, name, buf, buf_size);
}

static int get_query_var(struct mg_http_message *hm, const char *name,
                         char *buf, size_t buf_size) {
    return mg_http_get_var(&hm->query, name, buf, buf_size);
}

/* Returns 1 if session cookie found, 0 otherwise */
static int get_session_cookie(struct mg_http_message *hm, char *buf, size_t buf_size) {
    struct mg_str *cookie_header = mg_http_get_header(hm, "Cookie");
    if (cookie_header == NULL)
        return 0;

    const char *p = cookie_header->buf;
    const char *end = p + cookie_header->len;
    const char *prefix = "session=";
    size_t prefix_len = 8;

    while (p < end) {
        while (p < end && (*p == ' ' || *p == ';')) p++;

        if (p + prefix_len <= end && memcmp(p, prefix, prefix_len) == 0) {
            p += prefix_len;
            const char *value_start = p;
            while (p < end && *p != ';' && *p != ' ') p++;
            size_t value_len = p - value_start;

            if (value_len >= buf_size)
                value_len = buf_size - 1;

            memcpy(buf, value_start, value_len);
            buf[value_len] = '\0';
            return 1;
        }

        while (p < end && *p != ';') p++;
    }

    return 0;
}

/* Returns 1 if logged in, 0 otherwise */
static int get_current_user(struct mg_http_message *hm, User *user) {
    char session_token[65];

    if (!get_session_cookie(hm, session_token, sizeof(session_token)))
        return 0;

    return auth_get_user_from_session(session_token, user) == 0;
}

static void handle_login_page(struct mg_connection *c) {
    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head>\n"
        "<title>Login - Daily Puzzle</title>\n"
        "%s"
        "</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Login</div>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"content-meta\">\n"
        "  Enter your email to receive a magic login link.<br>\n"
        "  No password required.\n"
        "</div>\n"
        "<form method=\"POST\" action=\"/login\">\n"
        "  <div class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"email\" name=\"email\" placeholder=\"your@email.com\" required>\n"
        "  </div>\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Send Magic Link\n"
        "  </button>\n"
        "</form>\n"
        "<a href=\"/\" class=\"back-link\" style=\"margin-top:20px;\">\n"
        "  <span class=\"gt\">&gt;</span>Back\n"
        "</a>\n"
        "</body></html>\n",
        TERMINAL_CSS);
}

/* Sends email via Resend API. Pipes JSON body to curl stdin to avoid shell injection. */
static int send_email(const char *to, const char *subject, const char *html) {
    const char *api_key = getenv("RESEND_API_KEY");
    const char *from = getenv("RESEND_FROM_EMAIL");

    if (!api_key || !from)
        return -1;

    char cmd[512];
    snprintf(cmd, sizeof(cmd),
        "curl -sf -X POST https://api.resend.com/emails "
        "-H 'Authorization: Bearer %s' "
        "-H 'Content-Type: application/json' "
        "-d @-",
        api_key);

    FILE *fp = popen(cmd, "w");
    if (!fp)
        return -1;

    fprintf(fp,
        "{\"from\":\"%s\",\"to\":[\"%s\"],\"subject\":\"%s\",\"html\":\"%s\"}",
        from, to, subject, html);

    int status = pclose(fp);
    return (status == 0) ? 0 : -1;
}

static void handle_login_submit(struct mg_connection *c, struct mg_http_message *hm) {
    char ip[64] = {0};
    mg_snprintf(ip, sizeof(ip), "%M", mg_print_ip, &c->rem);

    if (!rate_limit_check(ip)) {
        mg_printf(c,
            "HTTP/1.1 429 Too Many Requests\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n<html><head><title>Rate Limited</title>%s</head>\n"
            "<body>\n"
            "<div class=\"page-header\">\n"
            "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Too Many Requests</div>\n"
            "  <hr class=\"nav-line\">\n"
            "</div>\n"
            "<div class=\"puzzle-box\">\n"
            "  <div>Too many login attempts.<br>Please wait a minute and try again.</div>\n"
            "</div>\n"
            "<a href=\"/login\" class=\"action-btn\">\n"
            "  <span class=\"gt\">&gt;</span>Back to login\n"
            "</a>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char email[256] = {0};

    if (get_form_var(hm, "email", email, sizeof(email)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Email is required.</p>\n"
            "<p><a href=\"/login\">&lt; Back to login</a></p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char token[65];
    if (auth_create_magic_link(email, token) != 0) {
        mg_printf(c,
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Failed to create login link.</p>\n"
            "<p><a href=\"/login\">&lt; Back to login</a></p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    const char *base_url = getenv("BASE_URL");
    if (!base_url) base_url = "http://localhost:8080";

    char link[512];
    snprintf(link, sizeof(link), "%s/auth?token=%s", base_url, token);

    const char *resend_key = getenv("RESEND_API_KEY");
    int is_prod = (resend_key != NULL && resend_key[0] != '\0');

    if (is_prod) {
        char html[1024];
        snprintf(html, sizeof(html),
            "<p>Click the link below to log in to Daily Puzzle:</p>"
            "<p><a href=\\\"%.400s\\\">Log in to Daily Puzzle</a></p>"
            "<p>This link expires in 15 minutes.</p>",
            link);

        if (send_email(email, "Your Daily Puzzle login link", html) != 0) {
            mg_printf(c,
                "HTTP/1.1 500 Internal Server Error\r\n"
                "Content-Type: text/html\r\n\r\n"
                "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
                "<body><div class=\"page-header\">\n"
                "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Error</div>\n"
                "  <hr class=\"nav-line\">\n"
                "</div>\n"
                "<div class=\"puzzle-box\"><div>Failed to send email.<br>Please try again.</div></div>\n"
                "<a href=\"/login\" class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>Back to login\n"
                "</a></body></html>\n",
                TERMINAL_CSS);
            return;
        }
    } else {
        printf("\n");
        printf("==============================================\n");
        printf("Magic login link for %s:\n", email);
        printf("%s\n", link);
        printf("==============================================\n");
        printf("\n");
        fflush(stdout);
    }

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head><title>Check Your Email</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Check Your Email</div>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"puzzle-box\">\n"
        "  <div>\n"
        "    Magic link sent to:<br>\n"
        "    <span style=\"color:#4ecca3;\">%s</span><br><br>\n"
        "    Click the link in the email to log in.\n"
        "  </div>\n"
        "</div>\n"
        "%s"
        "<a href=\"/login\" class=\"action-btn\">\n"
        "  <span class=\"gt\">&gt;</span>Back to login\n"
        "</a>\n"
        "</body></html>\n",
        TERMINAL_CSS, email,
        is_prod ? "" : "<div class=\"content-meta\">(Dev mode: check the server console for the link)</div>\n");
}

static void handle_auth(struct mg_connection *c, struct mg_http_message *hm) {
    char token[65];
    char session_token[65];
    int64_t user_id;

    if (get_query_var(hm, "token", token, sizeof(token)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Missing token.</p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    if (auth_validate_magic_link(token, session_token, &user_id) != 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n"
            "<html><head><title>Invalid Link</title>%s</head>\n"
            "<body>\n"
            "<h1>Invalid or Expired Link</h1>\n"
            "<p class=\"error\">This login link is invalid, expired, or has already been used.</p>\n"
            "<p><a href=\"/login\">&gt; Request a new login link</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    /* HttpOnly + SameSite=Strict: prevents XSS session theft and CSRF */
    char headers[512];
    snprintf(headers, sizeof(headers),
        "Set-Cookie: session=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=%d\r\n"
        "Location: /\r\n"
        "Content-Type: text/html\r\n",
        session_token, SESSION_EXPIRY_SECS);

    mg_http_reply(c, 302, headers,
        "<!DOCTYPE html>\n"
        "<html><head><title>Redirecting...</title></head>\n"
        "<body><p>Redirecting to <a href=\"/\">home page</a>...</p></body></html>\n");
}

static void handle_logout(struct mg_connection *c, struct mg_http_message *hm) {
    char session_token[65];

    if (get_session_cookie(hm, session_token, sizeof(session_token)))
        auth_logout(session_token);

    /* Max-Age=0 tells browser to delete the cookie */
    mg_http_reply(c, 302,
        "Set-Cookie: session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0\r\n"
        "Location: /\r\n"
        "Content-Type: text/html\r\n",
        "<!DOCTYPE html>\n"
        "<html><head><title>Logged Out</title></head>\n"
        "<body><p>Redirecting to <a href=\"/\">home page</a>...</p></body></html>\n");
}

static void handle_puzzle_page(struct mg_connection *c, struct mg_http_message *hm, User *user) {
    Puzzle puzzle;

    char wrong_param[8] = {0};
    struct mg_str query = hm->query;
    mg_http_get_var(&query, "wrong", wrong_param, sizeof(wrong_param));
    int show_wrong_feedback = (wrong_param[0] == '1');

    if (puzzle_get_today(&puzzle) != 0) {
        mg_printf(c,
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html>\n"
            "<html><head><title>Daily Puzzle</title>%s</head>\n"
            "<body>\n"
            "<div class=\"page-header\">\n"
            "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Daily Puzzle</div>\n"
            "  <nav class=\"nav\">\n"
            "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
            "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
            "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
            "  </nav>\n"
            "  <hr class=\"nav-line\">\n"
            "</div>\n"
            "<div class=\"puzzle-box\">\n"
            "  <div>No puzzle available yet.<br>Check back after 09:00 UTC!</div>\n"
            "</div>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    Attempt attempt;
    if (puzzle_get_attempt(user->id, puzzle.id, &attempt) == 0 && attempt.solved) {
        mg_http_reply(c, 302, "Location: /puzzle/result\r\n", "");
        return;
    }

    int hint_shown = (puzzle_get_attempt(user->id, puzzle.id, &attempt) == 0)
                     ? attempt.hint_used : 0;

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head>\n"
        "<title>Daily Puzzle</title>\n"
        "%s"
        "<script src=\"https://unpkg.com/htmx.org@1.9.10\"></script>\n"
        "</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Daily Puzzle</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"content-meta\">\n"
        "  %s<br>\n"
        "  Score: 100 pts base, -5 per wrong guess%s\n"
        "</div>\n"
        "<div class=\"puzzle-box\">\n"
        "  <div>%s</div>\n"
        "</div>\n"
        "<div id=\"hint-area\">%s%s%s</div>\n"
        "%s"
        "<form action=\"/puzzle/attempt\" method=\"POST\" hx-post=\"/puzzle/attempt\" hx-target=\"#feedback\" hx-swap=\"innerHTML\">\n"
        "  <input type=\"hidden\" name=\"puzzle_id\" value=\"%lld\">\n"
        "  <label class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"text\" name=\"guess\" placeholder=\"Enter your answer\" autocomplete=\"off\" required>\n"
        "  </label>\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Submit\n"
        "  </button>\n"
        "</form>\n"
        "<div id=\"feedback\" style=\"margin-top:15px;\">%s</div>\n"
        "</body></html>\n",
        TERMINAL_CSS,
        puzzle.puzzle_date,
        puzzle.has_hint ? ", -10 for hint" : "",
        puzzle.question,
        (puzzle.has_hint && hint_shown)
            ? "<div class=\"action-btn secondary\"><span class=\"gt\">&gt;</span>Hint: "
            : "",
        (puzzle.has_hint && hint_shown) ? puzzle.hint : "",
        (puzzle.has_hint && hint_shown) ? "</div>" : "",
        (puzzle.has_hint && !hint_shown)
            ? "<form action=\"/puzzle/hint\" method=\"POST\" hx-post=\"/puzzle/hint\" hx-target=\"#hint-area\" hx-swap=\"innerHTML\">\n"
              "  <input type=\"hidden\" name=\"puzzle_id\" value=\"0\">\n"
              "  <button type=\"submit\" class=\"action-btn secondary\">\n"
              "    <span class=\"gt\">&gt;</span>Hint? (-10 pts)\n"
              "  </button>\n"
              "</form>\n"
            : "",
        (long long)puzzle.id,
        show_wrong_feedback ? "<div style=\"color:#ff6b6b;\">Incorrect. Try again!</div>" : "");
}

static void handle_puzzle_attempt(struct mg_connection *c, struct mg_http_message *hm,
                                  User *user) {
    char guess[256] = {0};
    char puzzle_id_str[32] = {0};

    struct mg_str *hx_request = mg_http_get_header(hm, "HX-Request");
    int is_htmx = (hx_request != NULL && hx_request->len > 0);

    if (get_form_var(hm, "guess", guess, sizeof(guess)) <= 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Please enter an answer.</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }

    if (get_form_var(hm, "puzzle_id", puzzle_id_str, sizeof(puzzle_id_str)) <= 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Invalid request.</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }

    int64_t puzzle_id = atoll(puzzle_id_str);
    int score = 0;
    int result = puzzle_submit_guess(user->id, puzzle_id, guess, &score);

    if (result == 1) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#4ecca3;\">Correct! Redirecting...</div>\n"
                "<script>setTimeout(function() { window.location.href = '/puzzle/result'; }, 500);</script>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle/result\r\n", "");
        }
    } else if (result == 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Incorrect. Try again!</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle?wrong=1\r\n", "");
        }
    } else {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Something went wrong. Please try again.</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
    }
}

static void handle_puzzle_hint(struct mg_connection *c, struct mg_http_message *hm, User *user) {
    struct mg_str *hx_request = mg_http_get_header(hm, "HX-Request");
    int is_htmx = (hx_request != NULL && hx_request->len > 0);

    Puzzle puzzle;

    if (puzzle_get_today(&puzzle) != 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div class=\"action-btn\" style=\"border-color:#ff6b6b;\">"
                "<span class=\"gt\" style=\"color:#ff6b6b;\">&gt;</span>No puzzle available</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }

    char hint[512] = {0};
    if (puzzle_reveal_hint(user->id, puzzle.id, hint, sizeof(hint)) != 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div class=\"action-btn secondary\">"
                "<span class=\"gt\">&gt;</span>No hint available</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }

    if (is_htmx) {
        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
            "<div class=\"action-btn secondary\">"
            "<span class=\"gt\">&gt;</span>Hint: %s</div>\n", hint);
    } else {
        mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
    }
}

static void handle_puzzle_result(struct mg_connection *c, User *user) {
    Puzzle puzzle;

    if (puzzle_get_today(&puzzle) != 0) {
        mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        return;
    }

    Attempt attempt;
    if (puzzle_get_attempt(user->id, puzzle.id, &attempt) != 0 || !attempt.solved) {
        mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        return;
    }

    int guess_penalty = attempt.incorrect_guesses * 5;
    int hint_penalty = attempt.hint_used ? 10 : 0;
    int base_score = attempt.score + guess_penalty + hint_penalty;

    const char *time_desc;
    if (base_score >= 100) time_desc = "within 10 min";
    else if (base_score >= 90) time_desc = "10-30 min";
    else if (base_score >= 80) time_desc = "30-60 min";
    else if (base_score >= 75) time_desc = "1-2 hours";
    else if (base_score >= 70) time_desc = "2-3 hours";
    else time_desc = "3+ hours";

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head><title>Puzzle Complete!</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Puzzle Complete!</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"puzzle-box\" style=\"text-align:center;\">\n"
        "  <div>\n"
        "    <p style=\"color:#4ecca3;font-size:2.5em;margin:0;\">%d</p>\n"
        "    <p style=\"color:#808080;margin:5px 0 0 0;\">points</p>\n"
        "  </div>\n"
        "</div>\n"
        "<p style=\"color:#808080;\">Completed: %s</p>\n"
        "<p style=\"color:#808080;margin-top:15px;\">Time bonus: %d pts (%s)</p>\n"
        "<p style=\"color:#808080;\">Wrong guesses: %s%d pts</p>\n"
        "<p style=\"color:#808080;\">Hint: %s</p>\n"
        "<hr class=\"nav-line\">\n"
        "<p style=\"color:#4ecca3;\">Final score: %d pts</p>\n"
        "<p style=\"margin-top:20px;\">The answer was: <span style=\"color:#4ecca3;\">%s</span></p>\n"
        "<a href=\"/leagues\" class=\"action-btn\">\n"
        "  <span class=\"gt\">&gt;</span>View Leagues\n"
        "</a>\n"
        "</body></html>\n",
        TERMINAL_CSS,
        attempt.score,
        attempt.completed_at,
        base_score, time_desc,
        guess_penalty > 0 ? "-" : "",
        guess_penalty,
        attempt.hint_used ? "-10 pts" : "0 pts",
        attempt.score,
        puzzle.answer);
}

static void handle_leagues_list(struct mg_connection *c, User *user) {
    League leagues[50];
    int count;

    if (league_get_user_leagues(user->id, leagues, 50, &count) != 0) {
        mg_printf(c,
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body><h1>Error</h1>"
            "<p class=\"error\">Failed to load leagues.</p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    mg_http_printf_chunk(c,
        "<!DOCTYPE html>\n"
        "<html><head>\n"
        "<title>Leagues - Daily Puzzle</title>\n"
        "%s"
        "</head><body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Leagues</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n",
        TERMINAL_CSS);

    if (count == 0) {
        mg_http_printf_chunk(c,
            "<div class=\"content-meta\">You're not in any leagues yet.</div>\n");
    } else {
        mg_http_printf_chunk(c,
            "<table>\n"
            "<tr><th>Name</th><th style=\"width:60px;\">Pos</th><th style=\"width:80px; text-align:right;\">Pts</th></tr>\n");

        for (int i = 0; i < count; i++) {
            LeaderboardEntry entries[100];
            int entry_count;
            int user_pos = 0;
            int user_pts = 0;

            if (league_get_leaderboard_weekly(leagues[i].id, entries, 100, &entry_count) == 0) {
                for (int j = 0; j < entry_count; j++) {
                    if (entries[j].user_id == user->id) {
                        user_pos = entries[j].rank;
                        user_pts = entries[j].score;
                        break;
                    }
                }
            }

            mg_http_printf_chunk(c,
                "<tr>\n"
                "  <td><a href=\"/leagues/%lld\"><span class=\"gt\">&gt;</span> %s</a></td>\n"
                "  <td>%d</td>\n"
                "  <td style=\"text-align:right;\">%d</td>\n"
                "</tr>\n",
                (long long)leagues[i].id,
                leagues[i].name,
                user_pos,
                user_pts);
        }

        mg_http_printf_chunk(c, "</table>\n");
    }

    mg_http_printf_chunk(c,
        "<div style=\"margin-top:30px;\">\n"
        "<form method=\"POST\" action=\"/leagues\" style=\"margin-bottom:15px;\">\n"
        "  <div class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"text\" name=\"name\" placeholder=\"Create new league...\" required maxlength=\"255\">\n"
        "  </div>\n"
        "</form>\n"
        "<form method=\"POST\" action=\"/leagues/join\">\n"
        "  <div class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"text\" name=\"code\" placeholder=\"Join with code...\" required "
        "           maxlength=\"6\" style=\"text-transform:uppercase;\">\n"
        "  </div>\n"
        "</form>\n"
        "</div>\n");

    mg_http_printf_chunk(c, "</body></html>\n");
    mg_http_printf_chunk(c, "");
}

static void handle_league_create(struct mg_connection *c, struct mg_http_message *hm,
                                  User *user) {
    char name[256] = {0};

    if (get_form_var(hm, "name", name, sizeof(name)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">League name is required.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char invite_code[8];
    int64_t league_id = league_create(user->id, name, invite_code);

    if (league_id < 0) {
        mg_printf(c,
            "HTTP/1.1 500 Internal Server Error\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">Failed to create league.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char location[64];
    snprintf(location, sizeof(location), "Location: /leagues/%lld\r\n", (long long)league_id);
    mg_http_reply(c, 302, location, "");
}

static void handle_league_view(struct mg_connection *c, struct mg_http_message *hm,
                                User *user) {
    char id_str[32] = {0};
    int path_len = hm->uri.len;
    const char *path = hm->uri.buf;

    /* Extract ID after "/leagues/" (9 chars) */
    if (path_len <= 9) {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Not Found\n");
        return;
    }

    int id_len = path_len - 9;
    if (id_len >= (int)sizeof(id_str)) id_len = sizeof(id_str) - 1;
    memcpy(id_str, path + 9, id_len);
    id_str[id_len] = '\0';

    int64_t league_id = atoll(id_str);
    if (league_id <= 0) {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Not Found\n");
        return;
    }

    League league;
    if (league_get(league_id, &league) != 0) {
        mg_printf(c,
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>League Not Found</h1>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    if (!league_is_member(league_id, user->id)) {
        mg_printf(c,
            "HTTP/1.1 403 Forbidden\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Access Denied</h1>\n"
            "<p class=\"error\">You're not a member of this league.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    LeaderboardEntry entries[100];
    int entry_count;
    league_get_leaderboard_weekly(league_id, entries, 100, &entry_count);

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    mg_http_printf_chunk(c,
        "<!DOCTYPE html>\n"
        "<html><head>\n"
        "<title>%s - Daily Puzzle</title>\n"
        "%s"
        "</head><body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>%s</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n",
        league.name,
        TERMINAL_CSS,
        league.name);

    mg_http_printf_chunk(c,
        "<a href=\"/leagues\" class=\"back-link\"><span class=\"gt\">&gt;</span>Back to leagues</a>\n");

    mg_http_printf_chunk(c,
        "<table>\n"
        "<tr><th style=\"width:50px;\">Pos</th><th>Name</th><th style=\"width:80px; text-align:right;\">Pts</th></tr>\n");

    for (int i = 0; i < entry_count; i++) {
        mg_http_printf_chunk(c,
            "<tr>\n"
            "  <td>%d</td>\n"
            "  <td>%s</td>\n"
            "  <td style=\"text-align:right;\">%d</td>\n"
            "</tr>\n",
            entries[i].rank,
            entries[i].display_name,
            entries[i].score);
    }

    mg_http_printf_chunk(c, "</table>\n");

    mg_http_printf_chunk(c,
        "<div class=\"content-meta\" style=\"margin-top:30px;\">\n"
        "  Invite code: <span style=\"color:#e0e0e0;\">%s</span>\n"
        "</div>\n",
        league.invite_code);

    if (league.creator_id == user->id) {
        mg_http_printf_chunk(c,
            "<form action=\"/leagues/delete\" method=\"POST\" "
            "onsubmit=\"return confirm('Delete this league? This cannot be undone.');\">\n"
            "  <input type=\"hidden\" name=\"league_id\" value=\"%lld\">\n"
            "  <button type=\"submit\" class=\"action-btn secondary\">\n"
            "    <span class=\"gt\">&gt;</span>Delete league\n"
            "  </button>\n"
            "</form>\n",
            (long long)league_id);
    } else {
        mg_http_printf_chunk(c,
            "<form action=\"/leagues/leave\" method=\"POST\" "
            "onsubmit=\"return confirm('Leave this league?');\">\n"
            "  <input type=\"hidden\" name=\"league_id\" value=\"%lld\">\n"
            "  <button type=\"submit\" class=\"action-btn secondary\">\n"
            "    <span class=\"gt\">&gt;</span>Leave league\n"
            "  </button>\n"
            "</form>\n",
            (long long)league_id);
    }

    mg_http_printf_chunk(c, "</body></html>\n");
    mg_http_printf_chunk(c, "");
}

static void handle_league_join(struct mg_connection *c, struct mg_http_message *hm,
                                User *user) {
    char code[16] = {0};

    if (get_form_var(hm, "code", code, sizeof(code)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">Invite code is required.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    League league;
    if (league_get_by_code(code, &league) != 0) {
        mg_printf(c,
            "HTTP/1.1 404 Not Found\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Invalid Code</h1>\n"
            "<p class=\"error\">No league found with invite code: %s</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS, code);
        return;
    }

    if (league_join(league.id, user->id) != 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Cannot Join</h1>\n"
            "<p class=\"error\">You may already be a member of this league.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char location[64];
    snprintf(location, sizeof(location), "Location: /leagues/%lld\r\n", (long long)league.id);
    mg_http_reply(c, 302, location, "");
}

static void handle_league_leave(struct mg_connection *c, struct mg_http_message *hm,
                                 User *user) {
    char league_id_str[32] = {0};

    if (get_form_var(hm, "league_id", league_id_str, sizeof(league_id_str)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">League ID is required.</p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    int64_t league_id = atoll(league_id_str);

    if (league_leave(league_id, user->id) != 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1>\n"
            "<p class=\"error\">Could not leave the league. You may not be a member.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    mg_http_reply(c, 302, "Location: /leagues\r\n", "");
}

static void handle_league_delete(struct mg_connection *c, struct mg_http_message *hm,
                                  User *user) {
    char league_id_str[32] = {0};

    if (get_form_var(hm, "league_id", league_id_str, sizeof(league_id_str)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 400 Bad Request\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">League ID is required.</p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    int64_t league_id = atoll(league_id_str);

    if (league_delete(league_id, user->id) != 0) {
        mg_printf(c,
            "HTTP/1.1 403 Forbidden\r\n"
            "Content-Type: text/html\r\n\r\n"
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Cannot Delete</h1>\n"
            "<p class=\"error\">Only the league creator can delete the league.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    mg_http_reply(c, 302, "Location: /leagues\r\n", "");
}

static void handle_account_page(struct mg_connection *c, struct mg_http_message *hm,
                                 User *user) {
    char saved_param[8] = {0};
    struct mg_str query = hm->query;
    mg_http_get_var(&query, "saved", saved_param, sizeof(saved_param));
    int show_saved = (saved_param[0] == '1');

    const char *display = user->display_name[0] ? user->display_name : "";

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head><title>Account</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Account</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "%s"
        "<p style=\"color:#808080;margin-bottom:5px;\">Display Name</p>\n"
        "<form action=\"/account\" method=\"POST\">\n"
        "  <label class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"text\" name=\"display_name\" value=\"%s\" placeholder=\"Enter display name...\">\n"
        "  </label>\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Save\n"
        "  </button>\n"
        "</form>\n"
        "<p style=\"color:#808080;margin-bottom:5px;margin-top:20px;\">Email</p>\n"
        "<p style=\"margin-top:0;\">%s</p>\n"
        "<form action=\"/logout\" method=\"POST\" style=\"margin-top:20px;\">\n"
        "  <button type=\"submit\" class=\"action-btn secondary\">\n"
        "    <span class=\"gt\">&gt;</span>Logout\n"
        "  </button>\n"
        "</form>\n"
        "</body></html>\n",
        TERMINAL_CSS,
        show_saved ? "<div style=\"color:#4ecca3;margin-bottom:15px;\">Display name updated.</div>\n" : "",
        display,
        user->email);
}

static void handle_account_update(struct mg_connection *c, struct mg_http_message *hm,
                                   User *user) {
    char name[256] = {0};
    get_form_var(hm, "display_name", name, sizeof(name));
    auth_update_display_name(user->id, name);
    mg_http_reply(c, 302, "Location: /account?saved=1\r\n", "");
}

static void handle_archive_list(struct mg_connection *c, User *user) {
    Puzzle puzzles[100];
    int count = 0;

    if (puzzle_get_archive(puzzles, 100, &count) != 0) {
        mg_http_reply(c, 500, "Content-Type: text/plain\r\n", "Database error\n");
        return;
    }

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head><title>Archive</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Archive</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n",
        TERMINAL_CSS);

    if (count == 0) {
        mg_printf(c, "<p style=\"color:#808080;\">No archived puzzles yet.</p>\n");
    } else {
        for (int i = 0; i < count; i++) {
            Puzzle *p = &puzzles[i];
            Attempt attempt;
            int solved = (puzzle_get_attempt(user->id, p->id, &attempt) == 0 && attempt.solved);

            int year, month, day;
            sscanf(p->puzzle_date, "%d-%d-%d", &year, &month, &day);

            const char *gt_color = solved ? "#4ecca3" : "#ff9f43";

            mg_printf(c,
                "<p style=\"display:flex;justify-content:space-between;\">"
                "<a href=\"/archive/%lld\" style=\"text-decoration:none;\">"
                "<span class=\"gt\" style=\"color:%s;\">&gt;</span> Puzzle #%lld"
                "</a>"
                "<span style=\"color:#808080;\">%02d/%02d/%02d</span>"
                "</p>\n",
                (long long)p->id, gt_color, (long long)p->id,
                day, month, year % 100);
        }
    }

    mg_printf(c, "</body></html>\n");
}

static void handle_archive_puzzle(struct mg_connection *c, struct mg_http_message *hm,
                                   User *user) {
    char id_str[32] = {0};
    const char *uri = hm->uri.buf;
    const char *id_start = uri + 9;  /* skip "/archive/" */
    size_t id_len = hm->uri.len - 9;
    if (id_len >= sizeof(id_str)) id_len = sizeof(id_str) - 1;
    strncpy(id_str, id_start, id_len);

    int64_t puzzle_id = atoll(id_str);
    if (puzzle_id <= 0) {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Invalid puzzle ID\n");
        return;
    }

    char wrong_param[8] = {0};
    struct mg_str query = hm->query;
    mg_http_get_var(&query, "wrong", wrong_param, sizeof(wrong_param));
    int show_wrong_feedback = (wrong_param[0] == '1');

    Puzzle puzzle;
    if (puzzle_get_by_id(puzzle_id, &puzzle) != 0) {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Puzzle not found\n");
        return;
    }

    Attempt attempt;
    int has_attempt = (puzzle_get_attempt(user->id, puzzle_id, &attempt) == 0);
    int solved = has_attempt && attempt.solved;

    int year, month, day;
    sscanf(puzzle.puzzle_date, "%d-%d-%d", &year, &month, &day);

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n\r\n"
        "<!DOCTYPE html>\n"
        "<html><head><title>Puzzle #%lld</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Puzzle #%lld</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<p><a href=\"/archive\" class=\"back-link\"><span class=\"gt\">&gt;</span>Back to archive</a></p>\n"
        "<p style=\"color:#808080;\">%02d/%02d/%02d</p>\n"
        "<p style=\"color:#808080;\">Archived puzzles are for practice only. No points awarded.</p>\n"
        "<div class=\"puzzle-box\">%s</div>\n",
        (long long)puzzle_id, TERMINAL_CSS,
        (long long)puzzle_id,
        day, month, year % 100,
        puzzle.question);

    if (solved) {
        mg_printf(c,
            "<div class=\"action-btn\" style=\"text-align:center;color:#4ecca3;\">"
            "Solved! Answer: %s"
            "</div>\n",
            puzzle.answer);
    } else {
        if (puzzle.has_hint) {
            if (has_attempt && attempt.hint_used) {
                mg_printf(c,
                    "<div class=\"action-btn\">"
                    "<span class=\"gt\">&gt;</span>Hint: %s"
                    "</div>\n",
                    puzzle.hint);
            } else {
                mg_printf(c,
                    "<form action=\"/archive/%lld/hint\" method=\"POST\">\n"
                    "<button type=\"submit\" class=\"action-btn\">"
                    "<span class=\"gt\">&gt;</span>Hint?"
                    "</button>\n"
                    "</form>\n",
                    (long long)puzzle_id);
            }
        }

        mg_printf(c,
            "<form action=\"/archive/%lld/attempt\" method=\"POST\">\n"
            "<label class=\"action-btn\">\n"
            "  <span class=\"gt\">&gt;</span>\n"
            "  <input type=\"text\" name=\"answer\" placeholder=\"Your answer...\" autocomplete=\"off\">\n"
            "</label>\n"
            "<button type=\"submit\" class=\"action-btn\">"
            "<span class=\"gt\">&gt;</span>Submit"
            "</button>\n"
            "</form>\n"
            "<div style=\"margin-top:15px;\">%s</div>\n",
            (long long)puzzle_id,
            show_wrong_feedback ? "<div style=\"color:#ff6b6b;\">Incorrect. Try again!</div>" : "");
    }

    mg_printf(c, "</body></html>\n");
}

static void handle_archive_attempt(struct mg_connection *c, struct mg_http_message *hm,
                                    User *user) {
    char id_str[32] = {0};
    const char *uri = hm->uri.buf;
    const char *id_start = uri + 9;  /* skip "/archive/" */

    const char *id_end = strstr(id_start, "/attempt");
    if (!id_end) {
        mg_http_reply(c, 400, "Content-Type: text/plain\r\n", "Invalid request\n");
        return;
    }
    size_t id_len = id_end - id_start;
    if (id_len >= sizeof(id_str)) id_len = sizeof(id_str) - 1;
    strncpy(id_str, id_start, id_len);

    int64_t puzzle_id = atoll(id_str);

    char answer[256] = {0};
    if (get_form_var(hm, "answer", answer, sizeof(answer)) <= 0) {
        mg_printf(c,
            "HTTP/1.1 302 Found\r\n"
            "Location: /archive/%lld\r\n\r\n",
            (long long)puzzle_id);
        return;
    }

    int result = puzzle_submit_guess(user->id, puzzle_id, answer, NULL);

    if (result == 1) {
        mg_printf(c,
            "HTTP/1.1 302 Found\r\n"
            "Location: /archive/%lld\r\n\r\n",
            (long long)puzzle_id);
    } else {
        mg_printf(c,
            "HTTP/1.1 302 Found\r\n"
            "Location: /archive/%lld?wrong=1\r\n\r\n",
            (long long)puzzle_id);
    }
}

static void handle_archive_hint(struct mg_connection *c, struct mg_http_message *hm,
                                 User *user) {
    char id_str[32] = {0};
    const char *uri = hm->uri.buf;
    const char *id_start = uri + 9;  /* skip "/archive/" */

    const char *id_end = strstr(id_start, "/hint");
    if (!id_end) {
        mg_http_reply(c, 400, "Content-Type: text/plain\r\n", "Invalid request\n");
        return;
    }
    size_t id_len = id_end - id_start;
    if (id_len >= sizeof(id_str)) id_len = sizeof(id_str) - 1;
    strncpy(id_str, id_start, id_len);

    int64_t puzzle_id = atoll(id_str);

    char hint[512];
    puzzle_reveal_hint(user->id, puzzle_id, hint, sizeof(hint));

    mg_printf(c,
        "HTTP/1.1 302 Found\r\n"
        "Location: /archive/%lld\r\n\r\n",
        (long long)puzzle_id);
}

static void event_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev != MG_EV_HTTP_MSG) return;

    struct mg_http_message *hm = (struct mg_http_message *) ev_data;

    User user = {0};
    int logged_in = get_current_user(hm, &user);

    /* Health check */
    if (mg_match(hm->uri, mg_str("/health"), NULL)) {
        mg_http_reply(c, 200, "Content-Type: text/plain\r\n", "OK\n");

    } else if (mg_match(hm->uri, mg_str("/auth"), NULL)) {
        handle_auth(c, hm);

    } else if (mg_match(hm->uri, mg_str("/login"), NULL)) {
        if (logged_in) {
            mg_http_reply(c, 302, "Location: /\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_login_submit(c, hm);
        } else {
            handle_login_page(c);
        }

    } else if (mg_match(hm->uri, mg_str("/logout"), NULL)) {
        if (method_is(hm, "POST")) {
            handle_logout(c, hm);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else {
            handle_puzzle_page(c, hm, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle/attempt"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 401, "Content-Type: text/plain\r\n", "Unauthorized\n");
        } else if (method_is(hm, "POST")) {
            handle_puzzle_attempt(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle/hint"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 401, "Content-Type: text/plain\r\n", "Unauthorized\n");
        } else if (method_is(hm, "POST")) {
            handle_puzzle_hint(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle/result"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else {
            handle_puzzle_result(c, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/leagues/join"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_league_join(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/leagues/leave"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_league_leave(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/leagues/delete"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_league_delete(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    /* Must come after /leagues/join, /leagues/leave, /leagues/delete */
    } else if (mg_match(hm->uri, mg_str("/leagues/*"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else {
            handle_league_view(c, hm, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/leagues"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_league_create(c, hm, &user);
        } else {
            handle_leagues_list(c, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/archive/*/attempt"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_archive_attempt(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/archive/*/hint"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_archive_hint(c, hm, &user);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/archive/*"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else {
            handle_archive_puzzle(c, hm, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/archive"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else {
            handle_archive_list(c, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/account"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_account_update(c, hm, &user);
        } else {
            handle_account_page(c, hm, &user);
        }

    } else if (mg_match(hm->uri, mg_str("/"), NULL)) {
        if (logged_in) {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        } else {
            mg_printf(c,
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: text/html\r\n\r\n"
                "<!DOCTYPE html>\n"
                "<html><head><title>Daily Puzzle</title>%s</head>\n"
                "<body>\n"
                "<div class=\"page-header\">\n"
                "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Daily Puzzle</div>\n"
                "  <hr class=\"nav-line\">\n"
                "</div>\n"
                "<div class=\"puzzle-box\">\n"
                "  <div>\n"
                "    A new puzzle awaits<br>every day at 09:00 UTC.<br><br>\n"
                "    Compete with friends<br>in mini leagues!\n"
                "  </div>\n"
                "</div>\n"
                "<a href=\"/login\" class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>Login to start playing\n"
                "</a>\n"
                "</body></html>\n",
                TERMINAL_CSS);
        }

    } else {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Not Found\n");
    }
}

int main(void) {
    const char *db_path = getenv("PUZZLE_DB_PATH");
    if (!db_path) {
        const char *env = getenv("PUZZLE_ENV");
        if (env && strcmp(env, "prod") == 0)
            db_path = "data/puzzle.db";
        else
            db_path = "data/dev.db";
    }

    if (db_init(db_path) != 0) {
        fprintf(stderr, "Failed to initialize database\n");
        return 1;
    }

    auth_cleanup_expired();

    struct mg_mgr mgr;
    mg_mgr_init(&mgr);

    const char *port = getenv("PORT");
    if (!port) port = "8080";

    char listen_addr[64];
    snprintf(listen_addr, sizeof(listen_addr), "http://0.0.0.0:%s", port);

    mg_http_listen(&mgr, listen_addr, event_handler, NULL);
    printf("Server listening on port %s\n", port);

    for (;;)
        mg_mgr_poll(&mgr, 1000);

    mg_mgr_free(&mgr);
    return 0;
}
