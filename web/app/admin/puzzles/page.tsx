import Link from "next/link";
import { api } from "@/lib/api";
import { getCookieHeader } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
import AdminDeleteBtn from "./AdminDeleteBtn";

export default async function AdminPuzzlesPage() {
  const cookieHeader = await getCookieHeader();
  const puzzles = await api.admin.listPuzzles(cookieHeader);

  return (
    <PageShell isAdmin isLoggedIn>
      <h2><span className="gt">&gt;</span>Admin — Puzzles</h2>

      <Link href="/admin/puzzles/new" className="action-btn" style={{ display: "inline-block", marginBottom: 16, width: "auto", padding: "10px 20px" }}>
        <span className="gt">&gt;</span>New puzzle
      </Link>

      <table>
        <thead>
          <tr>
            <th>Date</th><th>Type</th><th>Name</th><th>Answer</th><th></th>
          </tr>
        </thead>
        <tbody>
          {puzzles.map((p) => (
            <tr key={p.id}>
              <td>{p.puzzle_date}</td>
              <td className="muted">{p.puzzle_type}</td>
              <td>{p.puzzle_name}</td>
              <td className="muted" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.answer}</td>
              <td>
                <Link href={`/admin/puzzles/${p.id}`} style={{ marginRight: 12, color: "var(--teal)" }}>edit</Link>
                <AdminDeleteBtn puzzleId={p.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
