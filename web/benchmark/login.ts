import { type Page } from '@playwright/test';
import { type ModelConfig } from './opencodeZen';

// Reserved per RFC 2606 — must match BENCHMARK_EMAIL_DOMAIN in backend/app/auth.py.
export const BENCHMARK_EMAIL_DOMAIN = '@benchmark.puzzlepause.invalid';

export function benchmarkEmail(model: ModelConfig): string {
    return `${model.account}${BENCHMARK_EMAIL_DOMAIN}`;
}

// Logs in as this model's one persistent bot account (same account every run, so its scores
// accumulate and it can sit in a league) without an emailed code, via the backend's
// /auth/benchmark-login bypass. Works against local or live deployments.
export async function benchmarkLoginAs(
    page: Page,
    baseUrl: string,
    model: ModelConfig
): Promise<void> {
    const secret = process.env.BENCHMARK_BYPASS_SECRET;
    if (!secret) {
        throw new Error('BENCHMARK_BYPASS_SECRET is not set (add it to web/.env.local)');
    }

    const email = benchmarkEmail(model);
    const res = await fetch(`${baseUrl}/api/auth/benchmark-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Benchmark-Secret': secret },
        body: JSON.stringify({ email, display_name: model.label }),
    });

    if (!res.ok) {
        throw new Error(`benchmark-login failed for ${email}: ${res.status} ${await res.text()}`);
    }

    // Match the `session` cookie by name rather than substring: the app also sets a
    // `guest_session` cookie elsewhere, and an unanchored /session=/ would happily match that
    // one (get('set-cookie') comma-joins multiple Set-Cookie values into a single string).
    const cookies = res.headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('session='));
    if (!sessionCookie) throw new Error('No session cookie returned from benchmark-login');
    const match = sessionCookie.match(/^session=([^;]+)/);
    if (!match) throw new Error('Could not parse session cookie');

    await page.context().addCookies([
        {
            name: 'session',
            value: match[1],
            domain: new URL(baseUrl).hostname,
            path: '/',
        },
    ]);
}
