import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser, getCookieHeader } from '@/lib/auth';
import PageShell from '@/components/ui/PageShell';
import ArchivePuzzleActions from './ArchivePuzzleActions';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    try {
        const puzzle = await api.archive.get(Number(id));
        const title = `#${puzzle.puzzle_number ?? puzzle.id}. ${puzzle.puzzle_name || puzzle.puzzle_type}`;
        const description = 'Can you solve this Puzzle Pause puzzle?';
        return {
            title,
            description,
            openGraph: { title, description, url: `/archive/${id}` },
            twitter: { card: 'summary_large_image', title, description },
        };
    } catch {
        return {};
    }
}

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
        <PageShell
            isLoggedIn={!!user}
            title={`#${puzzle!.puzzle_number ?? puzzle!.id}. ${puzzle!.puzzle_name || puzzle!.puzzle_type}`}
        >
            <Link href="/archive" className="back-link">
                <span className="gt">&gt;</span>Back to archive
            </Link>
            <ArchivePuzzleActions puzzle={puzzle!} isLoggedIn={!!user} />
        </PageShell>
    );
}
