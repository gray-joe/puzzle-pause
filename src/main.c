#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>
#include <signal.h>
#include "mongoose.h"
#include "db.h"
#include "auth.h"
#include "puzzle.h"
#include "league.h"
#include "util.h"

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

static int dev_mode = 0;

static void rate_limit_evict_expired(time_t now) {
    int i = 0;
    while (i < rate_limit_count) {
        if (now - rate_limit_table[i].window_start >= RATE_LIMIT_WINDOW_SECS) {
            rate_limit_table[i] = rate_limit_table[rate_limit_count - 1];
            rate_limit_count--;
        } else {
            i++;
        }
    }
}

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

    if (rate_limit_count >= RATE_LIMIT_MAX_IPS)
        rate_limit_evict_expired(now);

    if (rate_limit_count < RATE_LIMIT_MAX_IPS) {
        strncpy(rate_limit_table[rate_limit_count].ip, ip,
                sizeof(rate_limit_table[rate_limit_count].ip) - 1);
        rate_limit_table[rate_limit_count].window_start = now;
        rate_limit_table[rate_limit_count].attempts = 1;
        rate_limit_count++;
        return 1;
    }

    return 0;
}

static const char *TERMINAL_CSS =
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
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
    mg_http_reply(c, 200, "Content-Type: text/html\r\n",
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
        "  Enter your email to receive a login code.<br>\n"
        "  No password required.\n"
        "</div>\n"
        "<form method=\"POST\" action=\"/login\">\n"
        "  <div class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"email\" name=\"email\" placeholder=\"your@email.com\" required>\n"
        "  </div>\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Send Code\n"
        "  </button>\n"
        "</form>\n"
        "<a href=\"/\" class=\"back-link\" style=\"margin-top:20px;\">\n"
        "  <span class=\"gt\">&gt;</span>Back\n"
        "</a>\n"
        "</body></html>\n",
        TERMINAL_CSS);
}

/* Sends email via Resend API in a forked child process so the event loop is
   never blocked. Returns 0 (fire-and-forget). */
static int send_email(const char *to, const char *subject, const char *html) {
    const char *api_key = getenv("RESEND_API_KEY");
    const char *from = getenv("RESEND_FROM_EMAIL");

    if (!api_key || !from)
        return -1;

    char safe_from[512], safe_to[512], safe_subject[512], safe_html[4096];
    json_escape(from, safe_from, sizeof(safe_from));
    json_escape(to, safe_to, sizeof(safe_to));
    json_escape(subject, safe_subject, sizeof(safe_subject));
    json_escape(html, safe_html, sizeof(safe_html));

    char json[6144];
    snprintf(json, sizeof(json),
        "{\"from\":\"%s\",\"to\":[\"%s\"],\"subject\":\"%s\",\"html\":\"%s\"}",
        safe_from, safe_to, safe_subject, safe_html);

    pid_t pid = fork();
    if (pid < 0)
        return -1;

    if (pid == 0) {
        /* Child process: send email via curl, then exit */
        char auth_header[256];
        snprintf(auth_header, sizeof(auth_header), "Authorization: Bearer %s", api_key);

        execlp("curl", "curl", "-sf", "-m", "10",
               "-X", "POST", "https://api.resend.com/emails",
               "-H", auth_header,
               "-H", "Content-Type: application/json",
               "-d", json,
               (char *)NULL);
        _exit(1);
    }

    /* Parent: don't wait — SIGCHLD handler reaps */
    return 0;
}

static void get_client_ip(struct mg_connection *c, struct mg_http_message *hm,
                          char *ip, size_t ip_size) {
    struct mg_str *xff = mg_http_get_header(hm, "X-Forwarded-For");
    if (xff && xff->len > 0) {
        size_t len = xff->len;
        const char *comma = memchr(xff->buf, ',', xff->len);
        if (comma) len = (size_t)(comma - xff->buf);
        while (len > 0 && xff->buf[len - 1] == ' ') len--;
        const char *start = xff->buf;
        while (len > 0 && *start == ' ') { start++; len--; }
        if (len >= ip_size) len = ip_size - 1;
        memcpy(ip, start, len);
        ip[len] = '\0';
        return;
    }
    mg_snprintf(ip, ip_size, "%M", mg_print_ip, &c->rem);
}

static void handle_login_submit(struct mg_connection *c, struct mg_http_message *hm) {
    char ip[64] = {0};
    get_client_ip(c, hm, ip, sizeof(ip));

    if (!rate_limit_check(ip)) {
        mg_http_reply(c, 429, "Content-Type: text/html\r\n",
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
    char safe_email[1536] = {0};

    if (get_form_var(hm, "email", email, sizeof(email)) <= 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Email is required.</p>\n"
            "<p><a href=\"/login\">&lt; Back to login</a></p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char token[65];
    char code[AUTH_CODE_LEN + 1];
    if (auth_create_magic_link(email, token, code) != 0) {
        mg_http_reply(c, 500, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Failed to create login code.</p>\n"
            "<p><a href=\"/login\">&lt; Back to login</a></p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    html_escape(email, safe_email, sizeof(safe_email));

    const char *resend_key = getenv("RESEND_API_KEY");
    int is_prod = (resend_key != NULL && resend_key[0] != '\0');

    if (is_prod) {
        char html[1024];
        snprintf(html, sizeof(html),
            "<p>Your login code for Puzzle Pause is:</p>"
            "<p style=\\\"font-size:24px;font-weight:bold;letter-spacing:4px;\\\">%s</p>"
            "<p>This code expires in 15 minutes.</p>",
            code);

        if (send_email(email, "Your Puzzle Pause login code", html) != 0) {
            mg_http_reply(c, 500, "Content-Type: text/html\r\n",
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
        printf("Login code for %s: %s\n", email, code);
        printf("==============================================\n");
        printf("\n");
        fflush(stdout);
    }

    mg_http_reply(c, 200, "Content-Type: text/html\r\n",
        "<!DOCTYPE html>\n"
        "<html><head><title>Enter Code</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Enter Code</div>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"puzzle-box\">\n"
        "  <div>\n"
        "    Login code sent to:<br>\n"
        "    <span style=\"color:#4ecca3;\">%s</span>\n"
        "  </div>\n"
        "</div>\n"
        "%s"
        "<form action=\"/auth\" method=\"POST\">\n"
        "  <input type=\"hidden\" name=\"email\" value=\"%s\">\n"
        "  <label class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>\n"
        "    <input type=\"text\" name=\"code\" placeholder=\"Enter 6-digit code\" "
        "autocomplete=\"one-time-code\" maxlength=\"6\" "
        "style=\"text-transform:uppercase; letter-spacing:4px;\" required autofocus>\n"
        "  </label>\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Verify\n"
        "  </button>\n"
        "</form>\n"
        "<a href=\"/login\" class=\"action-btn secondary\">\n"
        "  <span class=\"gt\">&gt;</span>Back to login\n"
        "</a>\n"
        "</body></html>\n",
        TERMINAL_CSS, safe_email,
        is_prod ? "" : "<div class=\"content-meta\">(Dev mode: check the server console for the code)</div>\n",
        safe_email);
}

static void set_session_and_redirect(struct mg_connection *c, const char *session_token) {
    char headers[512];
    snprintf(headers, sizeof(headers),
        "Set-Cookie: session=%s; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=%d\r\n"
        "Location: /\r\n"
        "Content-Type: text/html\r\n",
        session_token, SESSION_EXPIRY_SECS);

    mg_http_reply(c, 302, headers,
        "<!DOCTYPE html>\n"
        "<html><head><title>Redirecting...</title></head>\n"
        "<body><p>Redirecting to <a href=\"/\">home page</a>...</p></body></html>\n");
}

static void handle_auth(struct mg_connection *c, struct mg_http_message *hm) {
    char token[65];
    char session_token[65];
    int64_t user_id;

    if (get_query_var(hm, "token", token, sizeof(token)) <= 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n<html><head><title>Error</title>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Missing token.</p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    if (auth_validate_magic_link(token, session_token, &user_id) != 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
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

    set_session_and_redirect(c, session_token);
}

static void handle_auth_code(struct mg_connection *c, struct mg_http_message *hm) {
    char email[256] = {0};
    char code[16] = {0};
    char safe_email[1536] = {0};
    char session_token[65];
    int64_t user_id;

    if (get_form_var(hm, "email", email, sizeof(email)) <= 0 ||
        get_form_var(hm, "code", code, sizeof(code)) <= 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n<html><head>%s</head>\n"
            "<body><h1>Error</h1><p class=\"error\">Email and code are required.</p>\n"
            "<p><a href=\"/login\">&lt; Back to login</a></p></body></html>\n",
            TERMINAL_CSS);
        return;
    }

    html_escape(email, safe_email, sizeof(safe_email));

    if (auth_validate_code(email, code, session_token, &user_id) != 0) {
        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n"
            "<html><head><title>Invalid Code</title>%s</head>\n"
            "<body>\n"
            "<div class=\"page-header\">\n"
            "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Invalid Code</div>\n"
            "  <hr class=\"nav-line\">\n"
            "</div>\n"
            "<div class=\"puzzle-box\">\n"
            "  <div>Invalid or expired code. Please try again.</div>\n"
            "</div>\n"
            "<form action=\"/auth\" method=\"POST\">\n"
            "  <input type=\"hidden\" name=\"email\" value=\"%s\">\n"
            "  <label class=\"action-btn\">\n"
            "    <span class=\"gt\">&gt;</span>\n"
            "    <input type=\"text\" name=\"code\" placeholder=\"Enter 6-digit code\" "
            "autocomplete=\"one-time-code\" maxlength=\"6\" "
            "style=\"text-transform:uppercase; letter-spacing:4px;\" required autofocus>\n"
            "  </label>\n"
            "  <button type=\"submit\" class=\"action-btn\">\n"
            "    <span class=\"gt\">&gt;</span>Verify\n"
            "  </button>\n"
            "</form>\n"
            "<a href=\"/login\" class=\"action-btn secondary\">\n"
            "  <span class=\"gt\">&gt;</span>Back to login\n"
            "</a>\n"
            "</body></html>\n",
            TERMINAL_CSS, safe_email);
        return;
    }

    set_session_and_redirect(c, session_token);
}

static void handle_logout(struct mg_connection *c, struct mg_http_message *hm) {
    char session_token[65];

    if (get_session_cookie(hm, session_token, sizeof(session_token)))
        auth_logout(session_token);

    /* Max-Age=0 tells browser to delete the cookie */
    mg_http_reply(c, 302,
        "Set-Cookie: session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0\r\n"
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

    const char *nav = user
        ? "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
          "    <a href=\"/archive\"><span class=\"gt\">&gt;</span>Archive</a>\n"
          "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        : "    <a href=\"/login\"><span class=\"gt\">&gt;</span>Login</a>\n";

    if (puzzle_get_today(&puzzle) != 0) {
        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n"
            "<html><head><title>Daily Puzzle</title>%s</head>\n"
            "<body>\n"
            "<div class=\"page-header\">\n"
            "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Daily Puzzle</div>\n"
            "  <nav class=\"nav\">\n"
            "%s"
            "  </nav>\n"
            "  <hr class=\"nav-line\">\n"
            "</div>\n"
            "<div class=\"puzzle-box\">\n"
            "  <div>No puzzle available yet.<br>Check back after 09:00 UTC!</div>\n"
            "</div>\n"
            "</body></html>\n",
            TERMINAL_CSS, nav);
        return;
    }

    int hint_shown = 0;
    if (user) {
        Attempt attempt;
        if (puzzle_get_attempt(user->id, puzzle.id, &attempt) == 0 && attempt.solved) {
            mg_http_reply(c, 302, "Location: /puzzle/result\r\n", "");
            return;
        }
        hint_shown = (puzzle_get_attempt(user->id, puzzle.id, &attempt) == 0)
                     ? attempt.hint_used : 0;
    }

    int show_hint_button = puzzle.has_hint && !hint_shown;

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    int pnum = puzzle_get_number(puzzle.id);
    char safe_pname[1024] = {0};
    html_escape(puzzle.puzzle_name, safe_pname, sizeof(safe_pname));

    mg_http_printf_chunk(c,
        "<!DOCTYPE html>\n"
        "<html><head>\n"
        "<title>#%d. %s</title>\n"
        "%s"
        "<script src=\"/static/htmx.min.js\" defer></script>\n"
        "</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>#%d. %s</div>\n"
        "  <nav class=\"nav\">\n"
        "%s"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<div class=\"content-meta\">\n"
        "  %s<br>\n"
        "  Score: 100 pts base, -5 per wrong guess%s\n"
        "%s"
        "</div>\n",
        pnum, safe_pname,
        TERMINAL_CSS,
        pnum, safe_pname,
        nav,
        puzzle.puzzle_date,
        puzzle.has_hint ? ", -10 for hint" : "",
        user ? "" : "  <br><a href=\"/login\">Log in</a> to save your score and compete in leagues.\n");

    if (strcmp(puzzle.puzzle_type, "ladder") == 0) {
        LadderStep steps[MAX_LADDER_STEPS];
        int step_count = puzzle_parse_ladder(puzzle.question, steps, MAX_LADDER_STEPS);

        mg_http_printf_chunk(c,
            "<div class=\"puzzle-box\" style=\"text-align:left;display:block;\">\n"
            "  <div>\n");
        for (int i = 0; i < step_count; i++) {
            if (steps[i].is_blank) {
                mg_http_printf_chunk(c, "    <div>%d. ____</div>\n", i + 1);
            } else {
                char safe_word[256] = {0};
                html_escape(steps[i].word, safe_word, sizeof(safe_word));
                mg_http_printf_chunk(c, "    <div>%d. %s</div>\n", i + 1, safe_word);
            }
        }
        mg_http_printf_chunk(c, "  </div>\n</div>\n");
    } else if (strcmp(puzzle.puzzle_type, "choice") == 0) {
        ChoicePuzzle cp;
        if (puzzle_parse_choice(puzzle.question, &cp) == 0) {
            char safe_prompt[2048] = {0};
            html_escape(cp.prompt, safe_prompt, sizeof(safe_prompt));
            mg_http_printf_chunk(c,
                "<div class=\"puzzle-box\">\n"
                "  <div>%s</div>\n"
                "</div>\n",
                safe_prompt);
        }
    } else {
        mg_http_printf_chunk(c,
            "<div class=\"puzzle-box\">\n"
            "  <div>%s</div>\n"
            "</div>\n",
            puzzle.question);
    }

    mg_http_printf_chunk(c,
        "<div id=\"hint-area\">%s%s%s</div>\n",
        (puzzle.has_hint && hint_shown)
            ? "<div class=\"action-btn secondary\"><span class=\"gt\">&gt;</span>Hint: "
            : "",
        (puzzle.has_hint && hint_shown) ? puzzle.hint : "",
        (puzzle.has_hint && hint_shown) ? "</div>" : "");
    if (show_hint_button) {
        mg_http_printf_chunk(c,
            "<form action=\"/puzzle/hint\" method=\"POST\" hx-post=\"/puzzle/hint\" hx-target=\"#hint-area\" hx-swap=\"innerHTML\">\n"
            "  <input type=\"hidden\" name=\"puzzle_id\" value=\"0\">\n"
            "  <button type=\"submit\" class=\"action-btn secondary\">\n"
            "    <span class=\"gt\">&gt;</span>Hint?%s\n"
            "  </button>\n"
            "</form>\n",
            user ? " (-10 pts)" : "");
    }

    mg_http_printf_chunk(c,
        "<form action=\"/puzzle/attempt\" method=\"POST\" hx-post=\"/puzzle/attempt\" hx-target=\"#feedback\" hx-swap=\"innerHTML\">\n"
        "  <input type=\"hidden\" name=\"puzzle_id\" value=\"%lld\">\n",
        (long long)puzzle.id);

    if (strcmp(puzzle.puzzle_type, "ladder") == 0) {
        LadderStep steps[MAX_LADDER_STEPS];
        int step_count = puzzle_parse_ladder(puzzle.question, steps, MAX_LADDER_STEPS);
        int blank_idx = 0;

        for (int i = 0; i < step_count; i++) {
            if (steps[i].is_blank) {
                mg_http_printf_chunk(c,
                    "  <label class=\"action-btn\">\n"
                    "    <span class=\"gt\">&gt;</span>\n"
                    "    <input type=\"text\" name=\"step_%d\" placeholder=\"Step %d\" autocomplete=\"off\" required>\n"
                    "  </label>\n",
                    blank_idx, i + 1);
                blank_idx++;
            }
        }
    } else if (strcmp(puzzle.puzzle_type, "choice") == 0) {
        ChoicePuzzle cp;
        if (puzzle_parse_choice(puzzle.question, &cp) == 0) {
            for (int i = 0; i < cp.num_options; i++) {
                char safe_opt[512] = {0};
                html_escape(cp.options[i], safe_opt, sizeof(safe_opt));
                mg_http_printf_chunk(c,
                    "  <label class=\"action-btn\">\n"
                    "    <span class=\"gt\">&gt;</span>\n"
                    "    <input type=\"radio\" name=\"guess\" value=\"%c\" required "
                    "style=\"margin-right:10px;\"> %c. %s\n"
                    "  </label>\n",
                    'a' + i, 'A' + i, safe_opt);
            }
        }
    } else if (strcmp(puzzle.puzzle_type, "math") == 0) {
        mg_http_printf_chunk(c,
            "  <label class=\"action-btn\">\n"
            "    <span class=\"gt\">&gt;</span>\n"
            "    <input type=\"number\" step=\"any\" name=\"guess\" placeholder=\"Enter your answer\" autocomplete=\"off\" required>\n"
            "  </label>\n");
    } else {
        mg_http_printf_chunk(c,
            "  <label class=\"action-btn\">\n"
            "    <span class=\"gt\">&gt;</span>\n"
            "    <input type=\"text\" name=\"guess\" placeholder=\"Enter your answer\" autocomplete=\"off\" required>\n"
            "  </label>\n");
    }

    mg_http_printf_chunk(c,
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Submit\n"
        "  </button>\n"
        "</form>\n"
        "<div id=\"feedback\" style=\"margin-top:15px;\">%s</div>\n"
        "</body></html>\n",
        show_wrong_feedback ? "<div style=\"color:#ff6b6b;\">Incorrect. Try again!</div>" : "");
    mg_http_printf_chunk(c, "");
}

/* Build full answer from ladder step form fields merged with the question template */
static int reconstruct_ladder_guess(struct mg_http_message *hm, const char *question,
                                    char *guess, size_t guess_size) {
    LadderStep steps[MAX_LADDER_STEPS];
    int step_count = puzzle_parse_ladder(question, steps, MAX_LADDER_STEPS);
    if (step_count <= 0)
        return -1;

    guess[0] = '\0';
    size_t pos = 0;
    int blank_idx = 0;

    for (int i = 0; i < step_count; i++) {
        if (i > 0 && pos < guess_size - 1)
            guess[pos++] = ' ';

        if (steps[i].is_blank) {
            char field_name[16];
            char field_val[64] = {0};
            snprintf(field_name, sizeof(field_name), "step_%d", blank_idx);
            blank_idx++;

            if (get_form_var(hm, field_name, field_val, sizeof(field_val)) <= 0)
                return -1;

            size_t vlen = strlen(field_val);
            if (pos + vlen >= guess_size) vlen = guess_size - pos - 1;
            memcpy(guess + pos, field_val, vlen);
            pos += vlen;
        } else {
            size_t wlen = strlen(steps[i].word);
            if (pos + wlen >= guess_size) wlen = guess_size - pos - 1;
            memcpy(guess + pos, steps[i].word, wlen);
            pos += wlen;
        }
    }

    guess[pos] = '\0';
    return 0;
}

static void handle_puzzle_attempt(struct mg_connection *c, struct mg_http_message *hm,
                                  User *user) {
    char guess[256] = {0};
    char puzzle_id_str[32] = {0};

    struct mg_str *hx_request = mg_http_get_header(hm, "HX-Request");
    int is_htmx = (hx_request != NULL && hx_request->len > 0);

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

    Puzzle puzzle;
    if (puzzle_get_by_id(puzzle_id, &puzzle) != 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Puzzle not found.</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }

    if (strcmp(puzzle.puzzle_type, "ladder") == 0) {
        if (reconstruct_ladder_guess(hm, puzzle.question, guess, sizeof(guess)) != 0) {
            if (is_htmx) {
                mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                    "<div style=\"color:#ff6b6b;\">Please fill in all blanks.</div>\n");
            } else {
                mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
            }
            return;
        }
    } else if (strcmp(puzzle.puzzle_type, "choice") == 0) {
        if (get_form_var(hm, "guess", guess, sizeof(guess)) <= 0) {
            if (is_htmx) {
                mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                    "<div style=\"color:#ff6b6b;\">Please select an option.</div>\n");
            } else {
                mg_http_reply(c, 302, "Location: /puzzle?wrong=1\r\n", "");
            }
            return;
        }
        ChoicePuzzle cp;
        if (puzzle_parse_choice(puzzle.question, &cp) != 0 ||
            strlen(guess) != 1 || guess[0] < 'a' || guess[0] > 'a' + cp.num_options - 1) {
            if (is_htmx) {
                mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                    "<div style=\"color:#ff6b6b;\">Invalid selection.</div>\n");
            } else {
                mg_http_reply(c, 302, "Location: /puzzle?wrong=1\r\n", "");
            }
            return;
        }
    } else if (get_form_var(hm, "guess", guess, sizeof(guess)) <= 0) {
        if (is_htmx) {
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<div style=\"color:#ff6b6b;\">Please enter an answer.</div>\n");
        } else {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        }
        return;
    }
    if (user) {
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
    } else {
        int result = puzzle_check_answer(puzzle_id, guess);

        if (result == 1) {
            time_t now = time(NULL);
            int score = puzzle_calculate_score(now, puzzle.puzzle_date, 0, 0);
            char location[64];
            snprintf(location, sizeof(location), "Location: /puzzle/result?score=%d\r\n", score);

            if (is_htmx) {
                mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                    "<div style=\"color:#4ecca3;\">Correct! Redirecting...</div>\n"
                    "<script>setTimeout(function() { window.location.href = '/puzzle/result?score=%d'; }, 500);</script>\n",
                    score);
            } else {
                mg_http_reply(c, 302, location, "");
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
    if (user) {
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
    } else {
        if (!puzzle.has_hint || puzzle.hint[0] == '\0') {
            if (is_htmx) {
                mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                    "<div class=\"action-btn secondary\">"
                    "<span class=\"gt\">&gt;</span>No hint available</div>\n");
            } else {
                mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
            }
            return;
        }
        snprintf(hint, sizeof(hint), "%s", puzzle.hint);
    }

    if (is_htmx) {
        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
            "<div class=\"action-btn secondary\">"
            "<span class=\"gt\">&gt;</span>Hint: %s</div>\n", hint);
    } else {
        mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
    }
}

static void handle_puzzle_result(struct mg_connection *c, struct mg_http_message *hm,
                                  User *user) {
    Puzzle puzzle;

    if (puzzle_get_today(&puzzle) != 0) {
        mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
        return;
    }

    char display_answer[256] = {0};
    strncpy(display_answer, puzzle.answer, sizeof(display_answer) - 1);
    char *pipe = strchr(display_answer, '|');
    if (pipe) *pipe = '\0';
    char safe_answer[1024] = {0};
    html_escape(display_answer, safe_answer, sizeof(safe_answer));

    if (user) {
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

        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
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
            safe_answer);
    } else {
        char score_str[16] = {0};
        struct mg_str query = hm->query;
        mg_http_get_var(&query, "score", score_str, sizeof(score_str));

        if (score_str[0] == '\0') {
            mg_http_reply(c, 302, "Location: /puzzle\r\n", "");
            return;
        }

        int score = atoi(score_str);
        if (score < 10) score = 10;
        if (score > 100) score = 100;

        mg_http_reply(c, 200, "Content-Type: text/html\r\n",
            "<!DOCTYPE html>\n"
            "<html><head><title>Puzzle Complete!</title>%s</head>\n"
            "<body>\n"
            "<div class=\"page-header\">\n"
            "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Puzzle Complete!</div>\n"
            "  <nav class=\"nav\">\n"
            "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
            "    <a href=\"/login\"><span class=\"gt\">&gt;</span>Login</a>\n"
            "  </nav>\n"
            "  <hr class=\"nav-line\">\n"
            "</div>\n"
            "<div class=\"puzzle-box\" style=\"text-align:center;\">\n"
            "  <div>\n"
            "    <p style=\"color:#4ecca3;font-size:2.5em;margin:0;\">%d</p>\n"
            "    <p style=\"color:#808080;margin:5px 0 0 0;\">points</p>\n"
            "  </div>\n"
            "</div>\n"
            "<p style=\"margin-top:20px;\">The answer was: <span style=\"color:#4ecca3;\">%s</span></p>\n"
            "<p style=\"color:#808080;margin-top:15px;\">"
            "<a href=\"/login\">Log in</a> to save your scores and compete in leagues.</p>\n"
            "<a href=\"/login\" class=\"action-btn\">\n"
            "  <span class=\"gt\">&gt;</span>Login\n"
            "</a>\n"
            "</body></html>\n",
            TERMINAL_CSS,
            score,
            safe_answer);
    }
}

static void handle_leagues_list(struct mg_connection *c, User *user) {
    League leagues[50];
    int count;

    if (league_get_user_leagues(user->id, leagues, 50, &count) != 0) {
        mg_http_reply(c, 500, "Content-Type: text/html\r\n",
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

            char safe_name[1536] = {0};
            html_escape(leagues[i].name, safe_name, sizeof(safe_name));
            mg_http_printf_chunk(c,
                "<tr>\n"
                "  <td><a href=\"/leagues/%lld\"><span class=\"gt\">&gt;</span> %s</a></td>\n"
                "  <td>%d</td>\n"
                "  <td style=\"text-align:right;\">%d</td>\n"
                "</tr>\n",
                (long long)leagues[i].id,
                safe_name,
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
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
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
        mg_http_reply(c, 500, "Content-Type: text/html\r\n",
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
        mg_http_reply(c, 404, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>League Not Found</h1>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    if (!league_is_member(league_id, user->id)) {
        mg_http_reply(c, 403, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Access Denied</h1>\n"
            "<p class=\"error\">You're not a member of this league.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char view_param[16] = {0};
    get_query_var(hm, "view", view_param, sizeof(view_param));
    if (view_param[0] == '\0')
        strncpy(view_param, "weekly", sizeof(view_param) - 1);

    int is_daily = (strcmp(view_param, "daily") == 0);
    int is_alltime = (strcmp(view_param, "alltime") == 0);

    LeaderboardEntry entries[100];
    int entry_count;
    if (is_daily)
        league_get_leaderboard_today(league_id, entries, 100, &entry_count);
    else if (is_alltime)
        league_get_leaderboard_alltime(league_id, entries, 100, &entry_count);
    else
        league_get_leaderboard_weekly(league_id, entries, 100, &entry_count);

    char safe_name[1536] = {0};
    html_escape(league.name, safe_name, sizeof(safe_name));

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
        safe_name,
        TERMINAL_CSS,
        safe_name);

    mg_http_printf_chunk(c,
        "<a href=\"/leagues\" class=\"back-link\"><span class=\"gt\">&gt;</span>Back to leagues</a>\n");

    mg_http_printf_chunk(c,
        "<div style=\"margin:15px 0;\">\n"
        "  <a href=\"/leagues/%lld?view=daily\" style=\"color:%s;margin-right:15px;\">Daily</a>\n"
        "  <a href=\"/leagues/%lld?view=weekly\" style=\"color:%s;margin-right:15px;\">Weekly</a>\n"
        "  <a href=\"/leagues/%lld?view=alltime\" style=\"color:%s;\">All Time</a>\n"
        "</div>\n",
        (long long)league_id, is_daily ? "#4ecca3" : "#808080",
        (long long)league_id, (!is_daily && !is_alltime) ? "#4ecca3" : "#808080",
        (long long)league_id, is_alltime ? "#4ecca3" : "#808080");

    mg_http_printf_chunk(c,
        "<table>\n"
        "<tr><th style=\"width:50px;\">Pos</th><th>Name</th><th style=\"width:80px; text-align:right;\">Pts</th></tr>\n");

    for (int i = 0; i < entry_count; i++) {
        char safe_display[1536] = {0};
        html_escape(entries[i].display_name, safe_display, sizeof(safe_display));
        char score_str[16];
        if (is_daily && entries[i].score < 0)
            snprintf(score_str, sizeof(score_str), "-");
        else
            snprintf(score_str, sizeof(score_str), "%d", entries[i].score);
        mg_http_printf_chunk(c,
            "<tr>\n"
            "  <td>%d</td>\n"
            "  <td>%s</td>\n"
            "  <td style=\"text-align:right;\">%s</td>\n"
            "</tr>\n",
            entries[i].rank,
            safe_display,
            score_str);
    }

    mg_http_printf_chunk(c, "</table>\n");

    const char *base_url = getenv("BASE_URL");
    if (!base_url) base_url = "http://localhost:8080";

    mg_http_printf_chunk(c,
        "<div class=\"content-meta\" style=\"margin-top:30px;\">\n"
        "  Invite code: <span style=\"color:#e0e0e0;\">%s</span><br>\n"
        "  <span id=\"join-link\" style=\"color:#e0e0e0;\">%s/leagues/join?code=%s</span>\n"
        "  <button onclick=\"var t=document.getElementById('join-link').textContent;"
        "if(navigator.clipboard){navigator.clipboard.writeText(t)"
        ".then(function(){this.textContent='Copied!'}.bind(this))"
        ".catch(function(){})}else{"
        "var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);"
        "a.select();document.execCommand('copy');document.body.removeChild(a);"
        "this.textContent='Copied!'}\" class=\"action-btn\" "
        "style=\"display:inline; padding:2px 10px; margin-left:8px; font-size:0.9em;\">"
        "Copy link</button>\n"
        "</div>\n",
        league.invite_code, base_url, league.invite_code);

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

static void handle_league_join_link(struct mg_connection *c, struct mg_http_message *hm,
                                     User *user) {
    char code[16] = {0};

    if (get_query_var(hm, "code", code, sizeof(code)) <= 0) {
        mg_http_reply(c, 302, "Location: /leagues\r\n", "");
        return;
    }

    League league;
    if (league_get_by_code(code, &league) != 0) {
        mg_http_reply(c, 404, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Invalid Link</h1>\n"
            "<p class=\"error\">No league found with that invite code.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    if (league_is_member(league.id, user->id)) {
        char location[64];
        snprintf(location, sizeof(location), "Location: /leagues/%lld\r\n", (long long)league.id);
        mg_http_reply(c, 302, location, "");
        return;
    }

    char safe_name[1536] = {0};
    html_escape(league.name, safe_name, sizeof(safe_name));

    mg_http_reply(c, 200, "Content-Type: text/html\r\n",
        "<!DOCTYPE html><html><head>\n"
        "<title>Join League - Daily Puzzle</title>\n"
        "%s"
        "</head><body>\n"
        "<h1>Join League</h1>\n"
        "<p>You've been invited to join <strong>%s</strong>.</p>\n"
        "<form action=\"/leagues/join\" method=\"POST\">\n"
        "  <input type=\"hidden\" name=\"code\" value=\"%s\">\n"
        "  <button type=\"submit\" class=\"action-btn\">\n"
        "    <span class=\"gt\">&gt;</span>Join league\n"
        "  </button>\n"
        "</form>\n"
        "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
        "</body></html>\n",
        TERMINAL_CSS, safe_name, league.invite_code);
}

static void handle_league_join(struct mg_connection *c, struct mg_http_message *hm,
                                User *user) {
    char code[16] = {0};

    if (get_form_var(hm, "code", code, sizeof(code)) <= 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">Invite code is required.</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    char safe_code[96] = {0};
    html_escape(code, safe_code, sizeof(safe_code));

    League league;
    if (league_get_by_code(code, &league) != 0) {
        mg_http_reply(c, 404, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Invalid Code</h1>\n"
            "<p class=\"error\">No league found with invite code: %s</p>\n"
            "<p><a href=\"/leagues\">&lt; Back to leagues</a></p>\n"
            "</body></html>\n",
            TERMINAL_CSS, safe_code);
        return;
    }

    if (league_join(league.id, user->id) != 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
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
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">League ID is required.</p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    int64_t league_id = atoll(league_id_str);

    if (league_leave(league_id, user->id) != 0) {
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
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
        mg_http_reply(c, 400, "Content-Type: text/html\r\n",
            "<!DOCTYPE html><html><head>%s</head><body>\n"
            "<h1>Error</h1><p class=\"error\">League ID is required.</p>\n"
            "</body></html>\n",
            TERMINAL_CSS);
        return;
    }

    int64_t league_id = atoll(league_id_str);

    if (league_delete(league_id, user->id) != 0) {
        mg_http_reply(c, 403, "Content-Type: text/html\r\n",
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
    char safe_display[1536] = {0};
    char safe_email[1536] = {0};
    html_escape(display, safe_display, sizeof(safe_display));
    html_escape(user->email, safe_email, sizeof(safe_email));

    UserStats stats;
    puzzle_get_user_stats(user->id, &stats);

    char daily_str[16];
    if (stats.daily_score >= 0)
        snprintf(daily_str, sizeof(daily_str), "%d", stats.daily_score);
    else
        snprintf(daily_str, sizeof(daily_str), "-");

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    mg_http_printf_chunk(c,
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
        "%s",
        TERMINAL_CSS,
        show_saved ? "<div style=\"color:#4ecca3;margin-bottom:15px;\">Display name updated.</div>\n" : "");

    mg_http_printf_chunk(c,
        "<div style=\"margin-bottom:25px;\">\n"
        "  <p style=\"color:#808080;margin-bottom:5px;\">Your Stats</p>\n"
        "  <table>\n"
        "    <tr><td style=\"color:#808080;\">Today</td>"
        "<td style=\"text-align:right;\">%s</td></tr>\n"
        "    <tr><td style=\"color:#808080;\">This week</td>"
        "<td style=\"text-align:right;\">%d</td></tr>\n"
        "    <tr><td style=\"color:#808080;\">All time</td>"
        "<td style=\"text-align:right;\">%d</td></tr>\n"
        "    <tr><td style=\"color:#808080;\">Average</td>"
        "<td style=\"text-align:right;\">%d</td></tr>\n"
        "    <tr><td style=\"color:#808080;\">Puzzles solved</td>"
        "<td style=\"text-align:right;\">%d</td></tr>\n"
        "  </table>\n",
        daily_str,
        stats.weekly_total, stats.alltime_total,
        stats.average_score, stats.puzzles_solved);

    if (stats.puzzles_solved > 0) {
        mg_http_printf_chunk(c,
            "  <p style=\"color:#4ecca3;\">Top %d%% of players</p>\n",
            stats.percentile);
    }

    mg_http_printf_chunk(c, "</div>\n");

    mg_http_printf_chunk(c,
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
        safe_display,
        safe_email);

    mg_http_printf_chunk(c, "");
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

    if (puzzle_get_archive(puzzles, 100, &count, dev_mode) != 0) {
        mg_http_reply(c, 500, "Content-Type: text/plain\r\n", "Database error\n");
        return;
    }

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    mg_http_printf_chunk(c,
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
        mg_http_printf_chunk(c, "<p style=\"color:#808080;\">No archived puzzles yet.</p>\n");
    } else {
        for (int i = 0; i < count; i++) {
            Puzzle *p = &puzzles[i];
            Attempt attempt;
            int solved = (puzzle_get_attempt(user->id, p->id, &attempt) == 0 && attempt.solved);

            int year, month, day;
            sscanf(p->puzzle_date, "%d-%d-%d", &year, &month, &day);

            const char *gt_color = solved ? "#4ecca3" : "#ff9f43";

            char safe_pname[1024] = {0};
            html_escape(p->puzzle_name, safe_pname, sizeof(safe_pname));
            int pnum = puzzle_get_number(p->id);
            mg_http_printf_chunk(c,
                "<p style=\"display:flex;justify-content:space-between;\">"
                "<a href=\"/archive/%lld\" style=\"text-decoration:none;\">"
                "<span class=\"gt\" style=\"color:%s;\">&gt;</span> #%d. %s"
                "</a>"
                "<span style=\"color:#808080;\">%02d/%02d/%02d</span>"
                "</p>\n",
                (long long)p->id, gt_color, pnum, safe_pname,
                day, month, year % 100);
        }
    }

    mg_http_printf_chunk(c, "</body></html>\n");
    mg_http_printf_chunk(c, "");
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

    char safe_pname[1024] = {0};
    char display_answer[256] = {0};
    char safe_answer[1024] = {0};
    html_escape(puzzle.puzzle_name, safe_pname, sizeof(safe_pname));
    strncpy(display_answer, puzzle.answer, sizeof(display_answer) - 1);
    char *pipe = strchr(display_answer, '|');
    if (pipe) *pipe = '\0';
    html_escape(display_answer, safe_answer, sizeof(safe_answer));

    mg_printf(c,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Transfer-Encoding: chunked\r\n\r\n");

    int pnum = puzzle_get_number(puzzle_id);
    mg_http_printf_chunk(c,
        "<!DOCTYPE html>\n"
        "<html><head><title>#%d. %s</title>%s</head>\n"
        "<body>\n"
        "<div class=\"page-header\">\n"
        "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>#%d. %s</div>\n"
        "  <nav class=\"nav\">\n"
        "    <a href=\"/puzzle\"><span class=\"gt\">&gt;</span>Daily Puzzle</a>\n"
        "    <a href=\"/leagues\"><span class=\"gt\">&gt;</span>Leagues</a>\n"
        "    <a href=\"/account\"><span class=\"gt\">&gt;</span>Account</a>\n"
        "  </nav>\n"
        "  <hr class=\"nav-line\">\n"
        "</div>\n"
        "<p><a href=\"/archive\" class=\"back-link\"><span class=\"gt\">&gt;</span>Back to archive</a></p>\n"
        "<p style=\"color:#808080;\">%02d/%02d/%02d</p>\n"
        "<p style=\"color:#808080;\">Archived puzzles are for practice only. No points awarded.</p>\n",
        pnum, safe_pname, TERMINAL_CSS,
        pnum, safe_pname,
        day, month, year % 100);

    if (strcmp(puzzle.puzzle_type, "ladder") == 0) {
        LadderStep steps[MAX_LADDER_STEPS];
        int step_count = puzzle_parse_ladder(puzzle.question, steps, MAX_LADDER_STEPS);

        mg_http_printf_chunk(c,
            "<div class=\"puzzle-box\" style=\"text-align:left;display:block;\">\n"
            "  <div>\n");
        for (int i = 0; i < step_count; i++) {
            if (steps[i].is_blank) {
                mg_http_printf_chunk(c, "    <div>%d. ____</div>\n", i + 1);
            } else {
                char safe_word[256] = {0};
                html_escape(steps[i].word, safe_word, sizeof(safe_word));
                mg_http_printf_chunk(c, "    <div>%d. %s</div>\n", i + 1, safe_word);
            }
        }
        mg_http_printf_chunk(c, "  </div>\n</div>\n");
    } else if (strcmp(puzzle.puzzle_type, "choice") == 0) {
        ChoicePuzzle cp;
        if (puzzle_parse_choice(puzzle.question, &cp) == 0) {
            char safe_prompt[2048] = {0};
            html_escape(cp.prompt, safe_prompt, sizeof(safe_prompt));
            mg_http_printf_chunk(c,
                "<div class=\"puzzle-box\">\n"
                "  <div>%s</div>\n"
                "</div>\n",
                safe_prompt);
        }
    } else {
        mg_http_printf_chunk(c, "<div class=\"puzzle-box\">%s</div>\n", puzzle.question);
    }

    if (solved) {
        mg_http_printf_chunk(c,
            "<div class=\"action-btn\" style=\"text-align:center;color:#4ecca3;\">"
            "Solved! Answer: %s"
            "</div>\n",
            safe_answer);
    } else {
        if (puzzle.has_hint) {
            if (has_attempt && attempt.hint_used) {
                mg_http_printf_chunk(c,
                    "<div class=\"action-btn\">"
                    "<span class=\"gt\">&gt;</span>Hint: %s"
                    "</div>\n",
                    puzzle.hint);
            } else {
                mg_http_printf_chunk(c,
                    "<form action=\"/archive/%lld/hint\" method=\"POST\">\n"
                    "<button type=\"submit\" class=\"action-btn\">"
                    "<span class=\"gt\">&gt;</span>Hint?"
                    "</button>\n"
                    "</form>\n",
                    (long long)puzzle_id);
            }
        }

        mg_http_printf_chunk(c,
            "<form action=\"/archive/%lld/attempt\" method=\"POST\">\n",
            (long long)puzzle_id);

        if (strcmp(puzzle.puzzle_type, "ladder") == 0) {
            LadderStep steps[MAX_LADDER_STEPS];
            int step_count = puzzle_parse_ladder(puzzle.question, steps, MAX_LADDER_STEPS);
            int blank_idx = 0;

            for (int i = 0; i < step_count; i++) {
                if (steps[i].is_blank) {
                    mg_http_printf_chunk(c,
                        "<label class=\"action-btn\">\n"
                        "  <span class=\"gt\">&gt;</span>\n"
                        "  <input type=\"text\" name=\"step_%d\" placeholder=\"Step %d\" autocomplete=\"off\" required>\n"
                        "</label>\n",
                        blank_idx, i + 1);
                    blank_idx++;
                }
            }
        } else if (strcmp(puzzle.puzzle_type, "choice") == 0) {
            ChoicePuzzle cp;
            if (puzzle_parse_choice(puzzle.question, &cp) == 0) {
                for (int i = 0; i < cp.num_options; i++) {
                    char safe_opt[512] = {0};
                    html_escape(cp.options[i], safe_opt, sizeof(safe_opt));
                    mg_http_printf_chunk(c,
                        "<label class=\"action-btn\">\n"
                        "  <span class=\"gt\">&gt;</span>\n"
                        "  <input type=\"radio\" name=\"answer\" value=\"%c\" required "
                        "style=\"margin-right:10px;\"> %c. %s\n"
                        "</label>\n",
                        'a' + i, 'A' + i, safe_opt);
                }
            }
        } else if (strcmp(puzzle.puzzle_type, "math") == 0) {
            mg_http_printf_chunk(c,
                "<label class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>\n"
                "  <input type=\"number\" step=\"any\" name=\"answer\" placeholder=\"Your answer...\" autocomplete=\"off\">\n"
                "</label>\n");
        } else {
            mg_http_printf_chunk(c,
                "<label class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>\n"
                "  <input type=\"text\" name=\"answer\" placeholder=\"Your answer...\" autocomplete=\"off\">\n"
                "</label>\n");
        }

        mg_http_printf_chunk(c,
            "<button type=\"submit\" class=\"action-btn\">"
            "<span class=\"gt\">&gt;</span>Submit"
            "</button>\n"
            "</form>\n"
            "<div style=\"margin-top:15px;\">%s</div>\n",
            show_wrong_feedback ? "<div style=\"color:#ff6b6b;\">Incorrect. Try again!</div>" : "");
    }

    mg_http_printf_chunk(c, "</body></html>\n");
    mg_http_printf_chunk(c, "");
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

    char loc[64], loc_wrong[64];
    snprintf(loc, sizeof(loc), "Location: /archive/%lld\r\n", (long long)puzzle_id);
    snprintf(loc_wrong, sizeof(loc_wrong), "Location: /archive/%lld?wrong=1\r\n", (long long)puzzle_id);

    char answer[256] = {0};
    Puzzle puzzle;
    int have_puzzle = (puzzle_get_by_id(puzzle_id, &puzzle) == 0);

    if (have_puzzle && strcmp(puzzle.puzzle_type, "ladder") == 0) {
        if (reconstruct_ladder_guess(hm, puzzle.question, answer, sizeof(answer)) != 0) {
            mg_http_reply(c, 302, loc, "");
            return;
        }
    } else if (have_puzzle && strcmp(puzzle.puzzle_type, "choice") == 0) {
        if (get_form_var(hm, "answer", answer, sizeof(answer)) <= 0) {
            mg_http_reply(c, 302, loc, "");
            return;
        }
        ChoicePuzzle cp;
        if (puzzle_parse_choice(puzzle.question, &cp) != 0 ||
            strlen(answer) != 1 || answer[0] < 'a' || answer[0] > 'a' + cp.num_options - 1) {
            mg_http_reply(c, 302, loc_wrong, "");
            return;
        }
    } else if (get_form_var(hm, "answer", answer, sizeof(answer)) <= 0) {
        mg_http_reply(c, 302, loc, "");
        return;
    }

    int result = puzzle_submit_guess(user->id, puzzle_id, answer, NULL);

    if (result == 1)
        mg_http_reply(c, 302, loc, "");
    else
        mg_http_reply(c, 302, loc_wrong, "");
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

    char loc[64];
    snprintf(loc, sizeof(loc), "Location: /archive/%lld\r\n", (long long)puzzle_id);
    mg_http_reply(c, 302, loc, "");
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
        if (method_is(hm, "POST"))
            handle_auth_code(c, hm);
        else
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
        handle_puzzle_page(c, hm, logged_in ? &user : NULL);

    } else if (mg_match(hm->uri, mg_str("/puzzle/attempt"), NULL)) {
        if (method_is(hm, "POST")) {
            handle_puzzle_attempt(c, hm, logged_in ? &user : NULL);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle/hint"), NULL)) {
        if (method_is(hm, "POST")) {
            handle_puzzle_hint(c, hm, logged_in ? &user : NULL);
        } else {
            mg_http_reply(c, 405, "Content-Type: text/plain\r\n", "Method Not Allowed\n");
        }

    } else if (mg_match(hm->uri, mg_str("/puzzle/result"), NULL)) {
        handle_puzzle_result(c, hm, logged_in ? &user : NULL);

    } else if (mg_match(hm->uri, mg_str("/leagues/join"), NULL)) {
        if (!logged_in) {
            mg_http_reply(c, 302, "Location: /login\r\n", "");
        } else if (method_is(hm, "POST")) {
            handle_league_join(c, hm, &user);
        } else {
            handle_league_join_link(c, hm, &user);
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
            mg_http_reply(c, 200, "Content-Type: text/html\r\n",
                "<!DOCTYPE html>\n"
                "<html><head><title>Puzzle Pause</title>%s</head>\n"
                "<body>\n"
                "<div class=\"page-header\">\n"
                "  <div class=\"page-title\"><span class=\"gt\">&gt;</span>Puzzle Pause</div>\n"
                "  <hr class=\"nav-line\">\n"
                "</div>\n"
                "<div class=\"puzzle-box\">\n"
                "  <div>\n"
                "    A new puzzle awaits<br>every day at 09:00 UTC.<br><br>\n"
                "    Compete with friends<br>in mini leagues!\n"
                "  </div>\n"
                "</div>\n"
                "<a href=\"/puzzle\" class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>Today's puzzle\n"
                "</a>\n"
                "<a href=\"/login\" class=\"action-btn\">\n"
                "  <span class=\"gt\">&gt;</span>Login\n"
                "</a>\n"
                "</body></html>\n",
                TERMINAL_CSS);
        }

    } else if (mg_match(hm->uri, mg_str("/static/*"), NULL)) {
        struct mg_http_serve_opts opts = {
            .root_dir = ".",
            .extra_headers = "Cache-Control: public, max-age=86400\r\n"
        };
        mg_http_serve_dir(c, hm, &opts);

    } else {
        mg_http_reply(c, 404, "Content-Type: text/plain\r\n", "Not Found\n");
    }
}

int main(void) {
    signal(SIGCHLD, SIG_IGN);

    const char *db_path = getenv("PUZZLE_DB_PATH");
    if (!db_path) {
        const char *env = getenv("PUZZLE_ENV");
        if (env && strcmp(env, "prod") == 0)
            db_path = "data/puzzle.db";
        else
            db_path = "data/dev.db";
    }

    const char *puzzle_env = getenv("PUZZLE_ENV");
    if (puzzle_env == NULL || strcmp(puzzle_env, "prod") != 0)
        dev_mode = 1;

    if (db_init(db_path) != 0) {
        fprintf(stderr, "Failed to initialize database\n");
        return 1;
    }

    auth_cleanup_expired();

    mg_log_set(MG_LL_INFO);

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
