import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import PageShell from '@/components/ui/PageShell';
import PreviewPuzzleShell from './PreviewPuzzleShell';

export default async function AdminPuzzlePreviewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireUser();
    const { id } = await params;
    const cookieHeader = await getCookieHeader();

    let puzzle = null;
    try {
        puzzle = await api.admin.getPuzzle(Number(id), cookieHeader);
    } catch {
        notFound();
    }

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <Link href={`/admin/puzzles/${id}`} className="back-link">
                <span className="gt">&gt;</span>Back to edit
            </Link>
            <h2>
                <span className="gt">&gt;</span>Preview —{' '}
                {puzzle!.puzzle_name || puzzle!.puzzle_type}
            </h2>
            <PreviewPuzzleShell puzzle={puzzle!} />
        </PageShell>
    );
}
