import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'setup_db',
            testMatch: /global\.setup\.ts/,
        },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup_db'],
        },
        {
            name: 'benchmark',
            testDir: './benchmark',
            testMatch: /text-puzzles\.spec\.ts/,
            // Up to MAX_GUESSES (3) model calls per test, each allowed up to 150s, plus retries
            // and page work — must exceed that, or a slow run is killed mid-play and the bot is
            // left with a half-finished attempt.
            timeout: 600_000,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup_db'],
        },
        {
            // Ad-hoc run against one puzzle URL (local or live) — no DB seed dependency, since
            // it logs in via the benchmark-login bypass rather than needing seeded archive data.
            name: 'benchmark-single',
            testDir: './benchmark',
            testMatch: /single-puzzle\.spec\.ts/,
            timeout: 600_000,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            // Today's daily puzzle, so the bots show on a league's today/weekly boards.
            name: 'benchmark-daily',
            testDir: './benchmark',
            testMatch: /daily\.spec\.ts/,
            timeout: 600_000,
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
