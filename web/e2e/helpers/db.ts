import { type Page } from "@playwright/test";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(__dirname, "../../../data/puzzle.db");

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
         ORDER BY id ASC LIMIT 1`,
      )
      .get(email, afterId) as { short_code: string } | undefined;
    if (!row) throw new Error(`No login code found for ${email}`);
    return row.short_code;
  } finally {
    db.close();
  }
}

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export async function loginAs(page: Page, email: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const minId = getMaxTokenId(email);

    await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const code = getLoginCode(email, minId);

    const res = await fetch(`${API_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (!match) throw new Error("Could not parse session cookie");
      await page.context().addCookies([
        {
          name: "session",
          value: match[1],
          domain: "localhost",
          path: "/",
        },
      ]);
      return;
    }

    if (attempt < 2) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  throw new Error("No session cookie returned");
}
