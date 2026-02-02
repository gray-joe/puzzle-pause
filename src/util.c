#include <stdio.h>
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
