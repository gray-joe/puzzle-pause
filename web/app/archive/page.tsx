import Link from 'next/link';
import { api, Puzzle } from '@/lib/api';
import { getUser, getCookieHeader } from '@/lib/auth';
import PageShell from '@/components/ui/PageShell';

const ARCHIVE_PAGE_SIZE = 50;

function single(v: string | string[] | undefined) {
    return Array.isArray(v) ? v[0] : v;
}

function pageFromSearchParams(params: Record<string, string | string[] | undefined>) {
    const parsed = Number(single(params.page) ?? '1');
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function archiveHref(page: number) {
    return page <= 1 ? '/archive' : `/archive?page=${page}`;
}

export default async function ArchivePage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [user, cookieHeader] = await Promise.all([getUser(), getCookieHeader()]);
    const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
    const page = pageFromSearchParams(params);
    const offset = (page - 1) * ARCHIVE_PAGE_SIZE;

    let puzzles: Puzzle[] = [];
    try {
        puzzles = await api.archive.list(cookieHeader, {
            limit: ARCHIVE_PAGE_SIZE + 1,
            offset,
        });
    } catch {}
    const hasNextPage = puzzles.length > ARCHIVE_PAGE_SIZE;
    const visiblePuzzles = puzzles.slice(0, ARCHIVE_PAGE_SIZE);
    const firstPuzzleNumber = offset + 1;
    const lastPuzzleNumber = offset + visiblePuzzles.length;

    return (
        <PageShell isLoggedIn={!!user}>
            {visiblePuzzles.length === 0 ? (
                <>
                    <div className="muted">
                        {page === 1 ? 'No past puzzles yet.' : 'No puzzles on this archive page.'}
                    </div>
                    {page > 1 && (
                        <Link href={archiveHref(page - 1)} className="back-link" style={{ marginTop: 16 }}>
                            <span className="gt">&gt;</span>Previous page
                        </Link>
                    )}
                </>
            ) : (
                <div>
                    <div className="muted" style={{ marginBottom: 12 }}>
                        Showing archived puzzles {firstPuzzleNumber}-{lastPuzzleNumber}
                    </div>
                    {visiblePuzzles.map((p) => (
                        <div key={p.id} className="list-row" data-testid={`archive-row-${p.id}`}>
                            <Link
                                href={`/archive/${p.id}`}
                                data-testid={
                                    user && p.solved === true
                                        ? `archive-solved-${p.id}`
                                        : user && p.solved === false
                                          ? `archive-unsolved-${p.id}`
                                          : undefined
                                }
                                style={{ display: 'flex', justifyContent: 'space-between' }}
                            >
                                <span>
                                    <span
                                        className={user && !p.solved ? '' : 'gt'}
                                        style={
                                            user && !p.solved
                                                ? { color: 'var(--orange)' }
                                                : undefined
                                        }
                                    >
                                        &gt;
                                    </span>{' '}
                                    #{p.puzzle_number ?? p.id}. {p.puzzle_name || p.puzzle_type}
                                </span>
                                <span className="muted">
                                    {p.puzzle_date.replace(
                                        /^(\d{4})-(\d{2})-(\d{2})$/,
                                        (_m, y, mo, d) => `${d}/${mo}/${y.slice(2)}`
                                    )}
                                </span>
                            </Link>
                        </div>
                    ))}
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            justifyContent: 'space-between',
                            marginTop: 24,
                        }}
                    >
                        {page > 1 ? (
                            <Link href={archiveHref(page - 1)} className="action-btn" style={{ width: 'auto' }}>
                                <span className="gt">&gt;</span>Previous
                            </Link>
                        ) : (
                            <span />
                        )}
                        {hasNextPage && (
                            <Link href={archiveHref(page + 1)} className="action-btn" style={{ width: 'auto' }}>
                                <span className="gt">&gt;</span>Next
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </PageShell>
    );
}
