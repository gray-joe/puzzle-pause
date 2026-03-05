import Link from "next/link";
import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import LeagueActions from "./LeagueActions";

export default async function LeaguesPage() {
  const user = await requireUser();
  const cookieHeader = await getCookieHeader();

  const leagues = await api.leagues.list(cookieHeader).catch(() => []);

  return (
    <PageShell isLoggedIn>
      {leagues.length === 0 ? (
        <div className="muted" data-testid="no-leagues" style={{ marginBottom: 16 }}>You're not in any leagues yet.</div>
      ) : (
        <div style={{ marginBottom: 24 }} data-testid="league-list">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {leagues.map((league) => (
                <tr key={league.id} data-testid={`league-row-${league.id}`}>
                  <td>
                    <Link href={`/leagues/${league.id}`}>
                      <span className="gt">&gt;</span> {league.name}
                    </Link>
                  </td>
                  <td>{league.user_rank ?? "—"}</td>
                  <td>{league.user_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeagueActions />
    </PageShell>
  );
}
