#ifndef UTIL_H
#define UTIL_H

#include <stddef.h>

int generate_random_bytes(unsigned char *buf, size_t len);
int generate_token_hex(char *out, size_t out_size, size_t byte_len);
long get_current_time(void);
void format_datetime(char *out, size_t out_size, long timestamp);
size_t html_escape(const char *src, char *dst, size_t dst_size);
size_t json_escape(const char *src, char *dst, size_t dst_size);

#endif /* UTIL_H */
