import Link from 'next/link';
import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import PageShell from '@/components/ui/PageShell';
import PuzzleForm from './PuzzleForm';

export default async function AdminPuzzleEditPage({ params }: { params: Promise<{ id: string }> }) {
    await requireUser();
    const { id } = await params;
    const cookieHeader = await getCookieHeader();

    const isNew = id === 'new';
    let puzzle = null;
    if (!isNew) {
        try {
            puzzle = await api.admin.getPuzzle(Number(id), cookieHeader);
        } catch {}
    }

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Link href="/admin/puzzles" className="back-link">
                    <span className="gt">&gt;</span>Back to puzzles
                </Link>
                {!isNew && (
                    <Link href={`/admin/puzzles/${id}/preview`} className="back-link">
                        <span className="gt">&gt;</span>Preview
                    </Link>
                )}
            </div>
            <h2>
                <span className="gt">&gt;</span>
                {isNew ? 'New Puzzle' : `Edit Puzzle — ${puzzle?.puzzle_date}`}
            </h2>
            <PuzzleForm puzzle={puzzle ?? undefined} />
        </PageShell>
    );
}
