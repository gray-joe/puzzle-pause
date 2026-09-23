// Has each bot account join a league by invite code, through the app's own /leagues/join
// endpoint (no direct DB writes). Idempotent: a bot already in the league is left alone.
//
// Usage: node benchmark/join-league.mjs <INVITE_CODE> [baseUrl]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const [inviteCode, baseUrl = 'http://localhost:3000'] = process.argv.slice(2);

if (!inviteCode) {
    console.error('Usage: node benchmark/join-league.mjs <INVITE_CODE> [baseUrl]');
    process.exit(1);
}

// Playwright loads .env.local via playwright.config.ts; this script runs on its own.
for (const line of fs.readFileSync(path.join(dir, '../.env.local'), 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}

const secret = process.env.BENCHMARK_BYPASS_SECRET;
if (!secret) {
    console.error('BENCHMARK_BYPASS_SECRET is not set (add it to web/.env.local)');
    process.exit(1);
}

const { models } = JSON.parse(fs.readFileSync(path.join(dir, 'models.config.json'), 'utf-8'));
const BENCHMARK_EMAIL_DOMAIN = '@benchmark.puzzlepause.invalid';

for (const model of models) {
    const email = `${model.account}${BENCHMARK_EMAIL_DOMAIN}`;

    const login = await fetch(`${baseUrl}/api/auth/benchmark-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Benchmark-Secret': secret },
        body: JSON.stringify({ email, display_name: model.label }),
    });
    if (!login.ok) {
        console.error(`${model.label}: login failed — ${login.status} ${await login.text()}`);
        continue;
    }
    const { token } = await login.json();

    // /leagues/join is idempotent — it returns the league unchanged if already a member.
    const join = await fetch(`${baseUrl}/api/leagues/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `session=${token}` },
        body: JSON.stringify({ invite_code: inviteCode }),
    });

    if (join.ok) {
        console.log(`${model.label}: in league ${(await join.json()).name}`);
    } else {
        console.error(`${model.label}: join failed — ${join.status} ${await join.text()}`);
    }
}
