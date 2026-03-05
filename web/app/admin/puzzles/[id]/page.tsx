import Link from "next/link";
import { api } from "@/lib/api";
import { getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import PuzzleForm from "./PuzzleForm";

export default async function AdminPuzzleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await getCookieHeader();

  const isNew = id === "new";
  let puzzle = null;
  if (!isNew) {
    try {
      puzzle = await api.admin.getPuzzle(Number(id), cookieHeader);
    } catch {}
  }

  return (
    <PageShell isAdmin isLoggedIn>
      <Link href="/admin/puzzles" className="back-link">
        <span className="gt">&gt;</span>Back to puzzles
      </Link>
      <h2><span className="gt">&gt;</span>{isNew ? "New Puzzle" : `Edit Puzzle — ${puzzle?.puzzle_date}`}</h2>
      <PuzzleForm puzzle={puzzle ?? undefined} />
    </PageShell>
  );
}
