import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import ArchivePuzzleActions from "./ArchivePuzzleActions";

export default async function ArchivePuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const puzzleId = Number(id);
  const [user, cookieHeader] = await Promise.all([getUser(), getCookieHeader()]);

  let puzzle = null;
  try {
    puzzle = await api.archive.get(puzzleId, cookieHeader);
  } catch {
    notFound();
  }

  return (
    <PageShell isLoggedIn={!!user}>
      <Link href="/archive" className="back-link">
        <span className="gt">&gt;</span>Back to archive
      </Link>
      <ArchivePuzzleActions puzzle={puzzle!} isLoggedIn={!!user} />
    </PageShell>
  );
}
