/*
 * test.h - Minimal Test Framework
 *
 * A simple test harness that tracks pass/fail counts and provides
 * assertion macros. This is intentionally minimal to show how testing
 * works without hiding it behind a complex framework.
 *
 * Usage:
 *   TEST(test_name) {
 *       ASSERT(1 + 1 == 2);
 *       ASSERT_STR_EQ("hello", "hello");
 *   }
 *
 *   int main() {
 *       test_init();
 *       RUN_TEST(test_name);
 *       return test_summary();
 *   }
 */

#ifndef TEST_H
#define TEST_H

#include <stdio.h>
#include <string.h>

/* Global counters for test results */
static int tests_run = 0;
static int tests_passed = 0;
static int tests_failed = 0;
static const char *current_test = NULL;

/* Initialize test counters */
static void test_init(void) {
    tests_run = 0;
    tests_passed = 0;
    tests_failed = 0;
}

/* Print test summary and return exit code (0 = all passed) */
static int test_summary(void) {
    printf("\n========================================\n");
    printf("Tests run: %d, Passed: %d, Failed: %d\n",
           tests_run, tests_passed, tests_failed);
    printf("========================================\n");
    return tests_failed > 0 ? 1 : 0;
}

/*
 * ASSERT macro - checks a condition and reports failure
 *
 * __FILE__ and __LINE__ are preprocessor macros that expand to
 * the current source file and line number - useful for error messages.
 */
#define ASSERT(condition) do { \
    if (!(condition)) { \
        printf("  FAIL: %s:%d: %s\n", __FILE__, __LINE__, #condition); \
        return 0; \
    } \
} while(0)

/* ASSERT_STR_EQ - compare two strings for equality */
#define ASSERT_STR_EQ(expected, actual) do { \
    if (strcmp((expected), (actual)) != 0) { \
        printf("  FAIL: %s:%d: expected \"%s\", got \"%s\"\n", \
               __FILE__, __LINE__, (expected), (actual)); \
        return 0; \
    } \
} while(0)

/* ASSERT_INT_EQ - compare two integers */
#define ASSERT_INT_EQ(expected, actual) do { \
    if ((expected) != (actual)) { \
        printf("  FAIL: %s:%d: expected %d, got %d\n", \
               __FILE__, __LINE__, (expected), (actual)); \
        return 0; \
    } \
} while(0)

/* ASSERT_NOT_NULL - check pointer is not NULL */
#define ASSERT_NOT_NULL(ptr) do { \
    if ((ptr) == NULL) { \
        printf("  FAIL: %s:%d: expected non-NULL\n", __FILE__, __LINE__); \
        return 0; \
    } \
} while(0)

/* ASSERT_NULL - check pointer is NULL */
#define ASSERT_NULL(ptr) do { \
    if ((ptr) != NULL) { \
        printf("  FAIL: %s:%d: expected NULL\n", __FILE__, __LINE__); \
        return 0; \
    } \
} while(0)

/*
 * TEST macro - defines a test function
 * Tests return 1 for pass, 0 for fail
 */
#define TEST(name) static int name(void)

/*
 * RUN_TEST macro - runs a test and updates counters
 */
#define RUN_TEST(name) do { \
    current_test = #name; \
    printf("Running %s... ", #name); \
    tests_run++; \
    if (name()) { \
        printf("PASS\n"); \
        tests_passed++; \
    } else { \
        tests_failed++; \
    } \
} while(0)

#endif /* TEST_H */
