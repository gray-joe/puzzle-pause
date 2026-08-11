import Link from 'next/link';
import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import { pageFromSearchParams, PageSearchParams } from '@/lib/pagination';
import PageShell from '@/components/ui/PageShell';
import PaginationControls from '@/components/ui/PaginationControls';
import AdminDeleteBtn from './AdminDeleteBtn';

const ADMIN_PAGE_SIZE = 50;

export default async function AdminPuzzlesPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams>;
}) {
    await requireUser();
    const cookieHeader = await getCookieHeader();
    const params = (await searchParams) ?? {};
    const page = pageFromSearchParams(params);
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    const puzzles = await api.admin.listPuzzles(cookieHeader, {
        limit: ADMIN_PAGE_SIZE + 1,
        offset,
    });
    const hasNextPage = puzzles.length > ADMIN_PAGE_SIZE;
    const visiblePuzzles = puzzles.slice(0, ADMIN_PAGE_SIZE);
    const firstPuzzleNumber = offset + 1;
    const lastPuzzleNumber = offset + visiblePuzzles.length;

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <h2>
                <span className="gt">&gt;</span>Admin — Puzzles
            </h2>

            <Link
                href="/admin/puzzles/new"
                className="action-btn"
                style={{
                    display: 'inline-block',
                    marginBottom: 16,
                    width: 'auto',
                    padding: '10px 20px',
                }}
            >
                <span className="gt">&gt;</span>New puzzle
            </Link>

            {visiblePuzzles.length > 0 ? (
                <p className="muted" style={{ marginBottom: 16 }}>
                    Showing puzzles {firstPuzzleNumber}-{lastPuzzleNumber}
                </p>
            ) : (
                <p className="muted" style={{ marginBottom: 16 }}>
                    {page === 1 ? 'No puzzles yet.' : 'No puzzles on this page.'}
                </p>
            )}

            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Answer</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {visiblePuzzles.map((p) => (
                        <tr key={p.id}>
                            <td>{p.puzzle_date}</td>
                            <td className="muted">{p.puzzle_type}</td>
                            <td>{p.puzzle_name}</td>
                            <td
                                className="muted"
                                style={{
                                    maxWidth: 120,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {p.answer}
                            </td>
                            <td>
                                <Link
                                    href={`/admin/puzzles/${p.id}`}
                                    style={{ marginRight: 12, color: 'var(--teal)' }}
                                >
                                    edit
                                </Link>
                                <Link
                                    href={`/admin/puzzles/${p.id}/preview`}
                                    style={{ marginRight: 12, color: 'var(--teal)' }}
                                >
                                    preview
                                </Link>
                                <AdminDeleteBtn puzzleId={p.id} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <PaginationControls
                basePath="/admin/puzzles"
                params={params}
                page={page}
                hasNextPage={hasNextPage}
            />
        </PageShell>
    );
}
