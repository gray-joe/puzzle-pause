import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import LeagueManage from "./LeagueManage";
import LeagueTabs from "./LeagueTabs";
import InviteSection from "./InviteSection";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const cookieHeader = await getCookieHeader();

  let league = null;
  try {
    league = await api.leagues.get(Number(id), cookieHeader);
  } catch {
    notFound();
  }

  return (
    <PageShell isLoggedIn>
      <Link href="/leagues" className="back-link">
        <span className="gt">&gt;</span>Back to leagues
      </Link>

      <h2 data-testid="league-name">
        <span className="gt">&gt;</span>{league!.name}
      </h2>
      <div className="content-meta" data-testid="league-member-count">
        {league!.member_count} member{league!.member_count !== 1 ? "s" : ""}
      </div>

      <LeagueTabs
        leaderboardToday={league!.leaderboard_today}
        leaderboardWeekly={league!.leaderboard_weekly}
        leaderboardAlltime={league!.leaderboard_alltime}
        tags={league!.tags}
      />

      <InviteSection inviteCode={league!.invite_code} />

      <LeagueManage
        leagueId={league!.id}
        isCreator={league!.creator_id === user.id}
      />
    </PageShell>
  );
}
