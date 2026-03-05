import Link from "next/link";
import { api } from "@/lib/api";
import { getUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import PuzzleActions from "./PuzzleActions";

export default async function PuzzlePage() {
  const [user, cookieHeader] = await Promise.all([getUser(), getCookieHeader()]);

  let puzzle = null;
  let error = null;
  try {
    puzzle = await api.puzzle.today(cookieHeader);
  } catch (e: any) {
    error = e.status === 404 ? "No puzzle today — check back at 09:00 UTC." : "Failed to load puzzle.";
  }

  const isAdmin = user
    ? (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).includes(user.email.toLowerCase())
    : false;

  return (
    <PageShell isAdmin={isAdmin} isLoggedIn={!!user}>
      {error ? (
        <div className="puzzle-box"><div className="muted" data-testid="puzzle-box">{error}</div></div>
      ) : puzzle ? (
        <PuzzleActions puzzle={puzzle} isLoggedIn={!!user} />
      ) : null}

      {!user && (
        <div className="content-meta" style={{ marginTop: 16 }}>
          <Link href="/login"><span className="gt" data-testid="login-link">&gt;</span>Log in</Link> to save your score.
        </div>
      )}
    </PageShell>
  );
}
