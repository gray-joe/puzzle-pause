import { api } from '@/lib/api';
import { requireUser, getCookieHeader } from '@/lib/auth';
import { pageFromSearchParams, PageSearchParams } from '@/lib/pagination';
import PageShell from '@/components/ui/PageShell';
import PaginationControls from '@/components/ui/PaginationControls';

const ADMIN_PAGE_SIZE = 50;

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams>;
}) {
    await requireUser();
    const cookieHeader = await getCookieHeader();
    const params = (await searchParams) ?? {};
    const page = pageFromSearchParams(params);
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    const users = await api.admin.listUsers(cookieHeader, {
        limit: ADMIN_PAGE_SIZE + 1,
        offset,
    });
    const hasNextPage = users.length > ADMIN_PAGE_SIZE;
    const visibleUsers = users.slice(0, ADMIN_PAGE_SIZE);
    const firstUserNumber = offset + 1;
    const lastUserNumber = offset + visibleUsers.length;

    return (
        <PageShell title="Admin" isAdmin isLoggedIn>
            <h2>
                <span className="gt">&gt;</span>Admin — Users
            </h2>

            <p className="muted" style={{ marginBottom: 16 }}>
                {visibleUsers.length > 0
                    ? `Showing users ${firstUserNumber}-${lastUserNumber}`
                    : page === 1
                      ? 'No users yet.'
                      : 'No users on this page.'}
            </p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Display Name</th>
                        <th>Joined</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleUsers.map((u) => (
                        <tr key={u.id}>
                            <td className="muted">{u.id}</td>
                            <td>{u.email}</td>
                            <td>{u.display_name ?? <span className="muted">—</span>}</td>
                            <td className="muted">
                                {new Date(u.created_at).toLocaleDateString('en-GB')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <PaginationControls basePath="/admin/users" params={params} page={page} hasNextPage={hasNextPage} />
        </PageShell>
    );
}
