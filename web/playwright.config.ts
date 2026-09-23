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
            timeout: 400_000, // up to two model calls per test, each allowed up to 150s
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup_db'],
        },
        {
            // Ad-hoc run against one puzzle URL (local or live) — no DB seed dependency, since
            // it logs in via the benchmark-login bypass rather than needing seeded archive data.
            name: 'benchmark-single',
            testDir: './benchmark',
            testMatch: /single-puzzle\.spec\.ts/,
            timeout: 400_000,
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
