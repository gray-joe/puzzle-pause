import Link from "next/link";
import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import AttemptForm from "./AttemptForm";

export default async function AdminAttemptEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cookieHeader = await getCookieHeader();
  const attempt = await api.admin.getAttempt(Number(id), cookieHeader);

  return (
    <PageShell title="Admin" isAdmin isLoggedIn>
      <Link href="/admin/attempts" className="back-link">
        <span className="gt">&gt;</span>Back to attempts
      </Link>
      <h2><span className="gt">&gt;</span>Edit Attempt #{attempt.id}</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        {attempt.user_display_name ?? attempt.user_email} — {attempt.puzzle_date} {attempt.puzzle_name}
      </p>
      <AttemptForm attempt={attempt} />
    </PageShell>
  );
}
