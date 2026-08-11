import Link from 'next/link';
import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import { pageFromSearchParams, PageSearchParams } from '@/lib/pagination';
import PageShell from '@/components/ui/PageShell';
import PaginationControls from '@/components/ui/PaginationControls';

const ADMIN_PAGE_SIZE = 50;

function fmt(dt: string | null) {
    if (!dt) return <span className="muted">—</span>;
    return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function AdminAttemptsPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams>;
}) {
    await requireUser();
    const cookieHeader = await getCookieHeader();
    const params = (await searchParams) ?? {};
    const page = pageFromSearchParams(params);
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    const attempts = await api.admin.listAttempts(cookieHeader, {
        limit: ADMIN_PAGE_SIZE + 1,
        offset,
    });
    const hasNextPage = attempts.length > ADMIN_PAGE_SIZE;
    const visibleAttempts = attempts.slice(0, ADMIN_PAGE_SIZE);
    const firstAttemptNumber = offset + 1;
    const lastAttemptNumber = offset + visibleAttempts.length;

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <h2>
                <span className="gt">&gt;</span>Admin — Attempts
            </h2>

            <p className="muted" style={{ marginBottom: 16 }}>
                {visibleAttempts.length > 0
                    ? `Showing attempts ${firstAttemptNumber}-${lastAttemptNumber}`
                    : page === 1
                      ? 'No attempts yet.'
                      : 'No attempts on this page.'}
            </p>

            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Puzzle</th>
                            <th>Type</th>
                            <th>Opened</th>
                            <th>Completed</th>
                            <th>Solved</th>
                            <th>Score</th>
                            <th>Wrong</th>
                            <th>Hint</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleAttempts.map((a) => (
                            <tr key={a.id}>
                                <td className="muted">{a.id}</td>
                                <td>{a.user_display_name ?? a.user_email}</td>
                                <td>
                                    <span style={{ color: 'var(--teal)' }}>{a.puzzle_date}</span>{' '}
                                    <span className="muted">{a.puzzle_name}</span>
                                </td>
                                <td className="muted">{a.puzzle_type}</td>
                                <td className="muted">{fmt(a.opened_at)}</td>
                                <td className="muted">{fmt(a.completed_at)}</td>
                                <td>
                                    {a.solved ? (
                                        <span className="success">yes</span>
                                    ) : (
                                        <span className="muted">no</span>
                                    )}
                                </td>
                                <td>{a.score ?? <span className="muted">—</span>}</td>
                                <td className="muted">{a.incorrect_guesses}</td>
                                <td>{a.hint_used ? <span className="muted">yes</span> : 'no'}</td>
                                <td>
                                    <Link href={`/admin/attempts/${a.id}`} className="back-link">
                                        <span className="gt">&gt;</span>edit
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <PaginationControls
                basePath="/admin/attempts"
                params={params}
                page={page}
                hasNextPage={hasNextPage}
            />
        </PageShell>
    );
}
