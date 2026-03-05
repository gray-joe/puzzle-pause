"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LeagueManage({ leagueId, isCreator }: { leagueId: number; isCreator: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLeave() {
    if (!confirm("Leave this league?")) return;
    setLoading(true);
    try {
      await api.leagues.leave(leagueId);
      router.push("/leagues");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to leave");
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this league? This cannot be undone.")) return;
    setLoading(true);
    try {
      await api.leagues.delete(leagueId);
      router.push("/leagues");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to delete");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <hr className="nav-line" />
      <button className="action-btn secondary" data-testid="leave-league-btn" onClick={handleLeave} disabled={loading}>
        <span className="gt">&gt;</span>Leave league
      </button>
      {isCreator && (
        <button className="action-btn secondary" data-testid="delete-league-btn" onClick={handleDelete} disabled={loading}>
          <span className="gt">&gt;</span>Delete league
        </button>
      )}
      {error && <div className="error" data-testid="league-manage-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
