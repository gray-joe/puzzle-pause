import { api } from "@/lib/api";
import { requireUser, getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";

export default async function AdminUsersPage() {
  await requireUser();
  const cookieHeader = await getCookieHeader();
  const users = await api.admin.listUsers(cookieHeader);

  return (
    <PageShell title="Admin" isAdmin isLoggedIn>
      <h2><span className="gt">&gt;</span>Admin — Users</h2>

      <p className="muted" style={{ marginBottom: 16 }}>{users.length} user{users.length !== 1 ? "s" : ""}</p>

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
          {users.map((u) => (
            <tr key={u.id}>
              <td className="muted">{u.id}</td>
              <td>{u.email}</td>
              <td>{u.display_name ?? <span className="muted">—</span>}</td>
              <td className="muted">{new Date(u.created_at).toLocaleDateString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
