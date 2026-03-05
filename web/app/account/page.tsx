import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import AccountActions from "./AccountActions";

export default async function AccountPage() {
  await requireUser();
  const cookieHeader = await getCookieHeader();
  const account = await api.account.get(cookieHeader);
  const stats = account.stats;

  const isAdmin = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(account.email.toLowerCase());

  return (
    <PageShell isAdmin={isAdmin} isLoggedIn>
      <div className="muted" style={{ marginBottom: 8 }}>Your Stats</div>

      <table data-testid="stats-table">
        <tbody>
          <tr>
            <td className="muted">Today</td>
            <td style={{ textAlign: "right" }} data-testid="stat-today">{stats.today_score ?? "—"}</td>
          </tr>
          <tr>
            <td className="muted">This week</td>
            <td style={{ textAlign: "right" }} data-testid="stat-weekly">{stats.weekly_total}</td>
          </tr>
          <tr>
            <td className="muted">All time</td>
            <td style={{ textAlign: "right" }} data-testid="stat-alltime">{stats.alltime_total}</td>
          </tr>
          <tr>
            <td className="muted">Average</td>
            <td style={{ textAlign: "right" }} data-testid="stat-average">{stats.average_score.toFixed(0)}</td>
          </tr>
          <tr>
            <td className="muted">Puzzles solved</td>
            <td style={{ textAlign: "right" }} data-testid="stat-solved">{stats.puzzles_solved}</td>
          </tr>
          <tr>
            <td className="muted">Streak</td>
            <td style={{ textAlign: "right", color: stats.streak > 0 ? "var(--teal)" : undefined }} data-testid="stat-streak">
              {stats.streak > 0 ? `${stats.streak} days` : "0"}
            </td>
          </tr>
        </tbody>
      </table>

      {stats.percentile !== null && (
        <div style={{ color: "var(--teal)", marginBottom: 16 }} data-testid="stat-percentile">
          Top {stats.percentile}% of players
        </div>
      )}

      <AccountActions displayName={account.display_name ?? ""} email={account.email} />
    </PageShell>
  );
}
