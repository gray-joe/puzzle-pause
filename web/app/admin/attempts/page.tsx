import Link from "next/link";
import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";

function fmt(dt: string | null) {
  if (!dt) return <span className="muted">—</span>;
  return new Date(dt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export default async function AdminAttemptsPage() {
  await requireUser();
  const cookieHeader = await getCookieHeader();
  const attempts = await api.admin.listAttempts(cookieHeader);

  return (
    <PageShell title="Admin" isAdmin isLoggedIn>
      <h2><span className="gt">&gt;</span>Admin — Attempts</h2>

      <p className="muted" style={{ marginBottom: 16 }}>{attempts.length} attempt{attempts.length !== 1 ? "s" : ""}</p>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Puzzle</th>
              <th>Type</th>
              <th>Opened</th>
              <th>Completed</th>
              <th>Solved</th>
              <th>Score</th>
              <th>Wrong</th>
              <th>Hint</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td className="muted">{a.id}</td>
                <td>{a.user_display_name ?? a.user_email}</td>
                <td>
                  <span style={{ color: "var(--teal)" }}>{a.puzzle_date}</span>
                  {" "}<span className="muted">{a.puzzle_name}</span>
                </td>
                <td className="muted">{a.puzzle_type}</td>
                <td className="muted">{fmt(a.opened_at)}</td>
                <td className="muted">{fmt(a.completed_at)}</td>
                <td>{a.solved ? <span className="success">yes</span> : <span className="muted">no</span>}</td>
                <td>{a.score ?? <span className="muted">—</span>}</td>
                <td className="muted">{a.incorrect_guesses}</td>
                <td>{a.hint_used ? <span className="muted">yes</span> : "no"}</td>
                <td><Link href={`/admin/attempts/${a.id}`} className="back-link"><span className="gt">&gt;</span>edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
