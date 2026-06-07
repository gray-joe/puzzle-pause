import { type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../../data/puzzle.db');
const LOGIN_LOCK_DIR = path.join(os.tmpdir(), 'daily-puzzle-e2e-login.lock');

function getMaxTokenId(email: string): number {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const row = db
            .prepare(`SELECT COALESCE(MAX(id), 0) as max_id FROM auth_tokens WHERE email = ?`)
            .get(email) as { max_id: number };
        return row.max_id;
    } finally {
        db.close();
    }
}

export function getLoginCode(email: string, afterId = 0): string {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const row = db
            .prepare(
                `SELECT short_code FROM auth_tokens
         WHERE email = ? AND used = 0 AND short_code IS NOT NULL AND id > ?
         ORDER BY id ASC LIMIT 1`
            )
            .get(email, afterId) as { short_code: string } | undefined;
        if (!row) throw new Error(`No login code found for ${email}`);
        return row.short_code;
    } finally {
        db.close();
    }
}

const API_URL = process.env.API_URL ?? 'http://localhost:8000';

async function withLoginLock<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            fs.mkdirSync(LOGIN_LOCK_DIR);
            try {
                return await fn();
            } finally {
                fs.rmSync(LOGIN_LOCK_DIR, { recursive: true, force: true });
            }
        } catch (err: any) {
            if (err?.code !== 'EEXIST') throw err;
            await new Promise((r) => setTimeout(r, 50));
        }
    }

    throw new Error('Timed out waiting for e2e login lock');
}

export function createPuzzleWithCompletionEvent() {
    const db = new Database(DB_PATH);
    const unique = Date.now();
    const puzzleDate = `2098-e2e-${unique}`;
    const puzzleName = `E2E Completion Event Puzzle ${unique}`;
    const now = new Date().toISOString();

    try {
        const result = db
            .prepare(
                `INSERT INTO puzzles
                 (puzzle_date, puzzle_type, puzzle_name, question, answer, hint, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(puzzleDate, 'math', puzzleName, 'What is 2+2?', '4', null, now);
        const puzzleId = Number(result.lastInsertRowid);

        db.prepare(
            `INSERT INTO puzzle_completion_events
             (puzzle_id, user_id, guest_session_id, completed_at, source, wrong_guess_count, time_to_complete_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(puzzleId, null, `e2e-guest-${unique}`, now, 'daily', 1, 42);

        return { puzzleId, puzzleDate, puzzleName };
    } finally {
        db.close();
    }
}

export function countCompletionEventsForPuzzle(puzzleId: number): number {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const row = db
            .prepare(`SELECT COUNT(*) as count FROM puzzle_completion_events WHERE puzzle_id = ?`)
            .get(puzzleId) as { count: number };
        return row.count;
    } finally {
        db.close();
    }
}

export function getUserByEmail(
    email: string
): { id: number; email: string; display_name: string } | null {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const row = db
            .prepare(`SELECT id, email, display_name FROM users WHERE email = ?`)
            .get(email) as { id: number; email: string; display_name: string } | undefined;
        return row ?? null;
    } finally {
        db.close();
    }
}

export function getLeagueById(leagueId: number): {
    id: number;
    name: string;
    creator_id: number;
} | null {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const row = db
            .prepare(`SELECT id, name, creator_id FROM leagues WHERE id = ?`)
            .get(leagueId) as { id: number; name: string; creator_id: number } | undefined;
        return row ?? null;
    } finally {
        db.close();
    }
}

export function getLeagueMemberIds(leagueId: number): number[] {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        const rows = db
            .prepare(`SELECT user_id FROM league_members WHERE league_id = ? ORDER BY user_id`)
            .all(leagueId) as { user_id: number }[];
        return rows.map((r) => r.user_id);
    } finally {
        db.close();
    }
}

export async function loginAs(page: Page, email: string): Promise<void> {
    await withLoginLock(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const minId = getMaxTokenId(email);

            await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const code = getLoginCode(email, minId);

            const res = await fetch(`${API_URL}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });

            const setCookie = res.headers.get('set-cookie');
            if (setCookie) {
                const match = setCookie.match(/session=([^;]+)/);
                if (!match) throw new Error('Could not parse session cookie');
                await page.context().addCookies([
                    {
                        name: 'session',
                        value: match[1],
                        domain: 'localhost',
                        path: '/',
                    },
                ]);
                return;
            }

            if (attempt < 2) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        }

        throw new Error('No session cookie returned');
    });
}
