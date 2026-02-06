#include <stdio.h>
#include <string.h>
#include <time.h>
#include "util.h"

int generate_random_bytes(unsigned char *buf, size_t len) {
    if (buf == NULL || len == 0)
        return -1;

    FILE *f = fopen("/dev/urandom", "rb");
    if (f == NULL)
        return -1;

    size_t read = fread(buf, 1, len, f);
    fclose(f);

    return (read == len) ? 0 : -1;
}

int generate_token_hex(char *out, size_t out_size, size_t byte_len) {
    if (out == NULL || out_size < byte_len * 2 + 1)
        return -1;

    unsigned char bytes[64];
    if (byte_len > sizeof(bytes))
        return -1;

    if (generate_random_bytes(bytes, byte_len) != 0)
        return -1;

    for (size_t i = 0; i < byte_len; i++)
        sprintf(out + (i * 2), "%02x", bytes[i]);

    out[byte_len * 2] = '\0';
    return 0;
}

long get_current_time(void) {
    return (long)time(NULL);
}

void format_datetime(char *out, size_t out_size, long timestamp) {
    if (out == NULL || out_size == 0)
        return;

    time_t t = (time_t)timestamp;
    struct tm *tm = gmtime(&t);
    strftime(out, out_size, "%Y-%m-%d %H:%M:%S", tm);
}

size_t html_escape(const char *src, char *dst, size_t dst_size) {
    if (!dst || dst_size == 0) return 0;
    if (!src) { dst[0] = '\0'; return 0; }

    size_t j = 0;
    for (size_t i = 0; src[i] && j < dst_size - 1; i++) {
        const char *esc;
        size_t elen;
        switch (src[i]) {
            case '&': esc = "&amp;";  elen = 5; break;
            case '<': esc = "&lt;";   elen = 4; break;
            case '>': esc = "&gt;";   elen = 4; break;
            case '"': esc = "&quot;"; elen = 6; break;
            case '\'': esc = "&#39;"; elen = 5; break;
            default: esc = NULL; elen = 0; break;
        }
        if (esc) {
            if (j + elen >= dst_size) break;
            memcpy(dst + j, esc, elen);
            j += elen;
        } else {
            dst[j++] = src[i];
        }
    }
    dst[j] = '\0';
    return j;
}

size_t json_escape(const char *src, char *dst, size_t dst_size) {
    if (!dst || dst_size == 0) return 0;
    if (!src) { dst[0] = '\0'; return 0; }

    size_t j = 0;
    for (size_t i = 0; src[i] && j < dst_size - 1; i++) {
        unsigned char ch = (unsigned char)src[i];
        if (ch == '"' || ch == '\\') {
            if (j + 2 >= dst_size) break;
            dst[j++] = '\\';
            dst[j++] = (char)ch;
        } else if (ch < 0x20) {
            if (j + 6 >= dst_size) break;
            j += (size_t)snprintf(dst + j, dst_size - j, "\\u%04x", ch);
        } else {
            dst[j++] = (char)ch;
        }
    }
    dst[j] = '\0';
    return j;
}
