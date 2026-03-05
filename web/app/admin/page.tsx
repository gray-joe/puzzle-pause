import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const cookieHeader = await getCookieHeader();

  const isAdmin = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(user.email.toLowerCase());

  const stats = await api.admin.stats(cookieHeader);

  return (
    <PageShell title="Admin" isAdmin={isAdmin} isLoggedIn>
      <h2><span className="gt">&gt;</span>Admin — Dashboard</h2>

      <table>
        <thead>
          <tr>
            <th>Metric</th><th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Puzzles</td><td>{stats.puzzles}</td></tr>
          <tr><td>Players</td><td>{stats.players}</td></tr>
          <tr><td>Attempts</td><td>{stats.attempts}</td></tr>
        </tbody>
      </table>
    </PageShell>
  );
}
