import Link from "next/link";
import { api, Puzzle } from "@/lib/api";
import { getUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";

export default async function ArchivePage() {
  const [user, cookieHeader] = await Promise.all([getUser(), getCookieHeader()]);

  let puzzles: Puzzle[] = [];
  try {
    puzzles = await api.archive.list(cookieHeader);
  } catch { }

  return (
    <PageShell isLoggedIn={!!user}>
      {puzzles.length === 0 ? (
        <div className="muted">No past puzzles yet.</div>
      ) : (
        <div>
          {puzzles.map((p) => (
            <div key={p.id} className="list-row" data-testid={`archive-row-${p.id}`}>
              <Link href={`/archive/${p.id}`} data-testid={user && p.solved === true ? `archive-solved-${p.id}` : user && p.solved === false ? `archive-unsolved-${p.id}` : undefined} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  <span className={user && !p.solved ? "" : "gt"} style={user && !p.solved ? { color: "var(--orange)" } : undefined}>&gt;</span>
                  {" "}#{p.puzzle_number ?? p.id}. {p.puzzle_name || p.puzzle_type}
                </span>
                <span className="muted">{p.puzzle_date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_m, y, mo, d) => `${d}/${mo}/${y.slice(2)}`)}</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
