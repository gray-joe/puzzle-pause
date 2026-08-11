import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import { pageFromSearchParams, PageSearchParams, single } from '@/lib/pagination';
import PageShell from '@/components/ui/PageShell';
import PaginationControls from '@/components/ui/PaginationControls';
import Link from 'next/link';

function fmtDateTime(dt: string) {
    return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtSeconds(totalSeconds: number | null) {
    if (totalSeconds === null) return <span className="muted">—</span>;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
}

export default async function AdminCompletionEventsPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams>;
}) {
    await requireUser();
    const cookieHeader = await getCookieHeader();
    const params = (await searchParams) ?? {};
    const page = pageFromSearchParams(params);

    const source = single(params.source);
    const actor = single(params.actor);
    const puzzleType = (single(params.puzzle_type) ?? '').trim();
    const completedFrom = (single(params.completed_from) ?? '').trim();
    const completedTo = (single(params.completed_to) ?? '').trim();
    const limitRaw = single(params.limit);
    const parsedLimit = Number(limitRaw ?? 50);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 999) : 50;
    const offset = (page - 1) * limit;

    const events = await api.admin.listCompletionEvents(
        {
            source: source === 'daily' || source === 'archive' ? source : undefined,
            actor: actor === 'guest' || actor === 'auth' ? actor : undefined,
            puzzle_type: puzzleType || undefined,
            completed_from: completedFrom || undefined,
            completed_to: completedTo || undefined,
            limit: limit + 1,
            offset,
        },
        cookieHeader
    );
    const hasNextPage = events.length > limit;
    const visibleEvents = events.slice(0, limit);
    const firstEventNumber = offset + 1;
    const lastEventNumber = offset + visibleEvents.length;

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <h2>
                <span className="gt">&gt;</span>Admin — Completion Events
            </h2>

            <p className="muted" style={{ marginBottom: 16 }}>
                {visibleEvents.length > 0
                    ? `Showing completion events ${firstEventNumber}-${lastEventNumber}`
                    : page === 1
                      ? 'No completion events yet.'
                      : 'No completion events on this page.'}
            </p>

            <form
                method="get"
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
            >
                <select name="source" defaultValue={source ?? ''}>
                    <option value="">All sources</option>
                    <option value="daily">daily</option>
                    <option value="archive">archive</option>
                </select>

                <select name="actor" defaultValue={actor ?? ''}>
                    <option value="">All actors</option>
                    <option value="auth">auth</option>
                    <option value="guest">guest</option>
                </select>

                <input
                    name="puzzle_type"
                    defaultValue={puzzleType}
                    placeholder="puzzle type"
                    style={{ minWidth: 130 }}
                />

                <input
                    name="completed_from"
                    type="date"
                    defaultValue={completedFrom}
                    title="Completed from"
                />

                <input
                    name="completed_to"
                    type="date"
                    defaultValue={completedTo}
                    title="Completed to"
                />

                <input
                    name="limit"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={String(limit)}
                    style={{ width: 96 }}
                />

                <button
                    className="action-btn"
                    type="submit"
                    style={{ width: 'auto', padding: '8px 14px' }}
                >
                    <span className="gt">&gt;</span>Apply
                </button>

                <Link
                    href="/admin/completion-events"
                    className="back-link"
                    style={{ alignSelf: 'center' }}
                >
                    <span className="gt">&gt;</span>Clear
                </Link>
            </form>

            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Completed</th>
                            <th>Source</th>
                            <th>Puzzle</th>
                            <th>User</th>
                            <th>Guest Session</th>
                            <th>Wrong Guesses</th>
                            <th>Time to Complete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleEvents.map((event) => (
                            <tr key={event.id}>
                                <td className="muted">{event.id}</td>
                                <td className="muted">{fmtDateTime(event.completed_at)}</td>
                                <td>{event.source}</td>
                                <td>
                                    <span style={{ color: 'var(--teal)' }}>
                                        {event.puzzle_date}
                                    </span>{' '}
                                    <span className="muted">{event.puzzle_name}</span>
                                </td>
                                <td>
                                    {event.user_id ? (
                                        <>{event.user_display_name ?? event.user_email}</>
                                    ) : (
                                        <span className="muted">guest</span>
                                    )}
                                </td>
                                <td className="muted">
                                    {event.guest_session_id ?? <span className="muted">—</span>}
                                </td>
                                <td className="muted">
                                    {event.wrong_guess_count ?? <span className="muted">—</span>}
                                </td>
                                <td className="muted">
                                    {fmtSeconds(event.time_to_complete_seconds)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <PaginationControls
                basePath="/admin/completion-events"
                params={params}
                page={page}
                hasNextPage={hasNextPage}
            />
        </PageShell>
    );
}
