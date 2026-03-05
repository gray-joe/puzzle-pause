"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LeagueActions() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError("");
    try {
      const league = await api.leagues.create(name.trim());
      router.push(`/leagues/${league.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to create league");
    } finally { setLoading(false); }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError("");
    try {
      const league = await api.leagues.join(code.trim());
      router.push(`/leagues/${league.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "League not found");
    } finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={handleCreate} data-testid="create-league-form">
        <div className="action-btn">
          <span className="gt">&gt;</span>
          <input
            data-testid="league-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Create new league..."
            required
            style={{ background: "transparent", border: "none", width: "calc(100% - 30px)" }}
          />
        </div>
      </form>

      <form onSubmit={handleJoin} data-testid="join-league-form">
        <div className="action-btn secondary">
          <span className="gt">&gt;</span>
          <input
            data-testid="invite-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="JOIN WITH CODE..."
            maxLength={6}
            required
            style={{ background: "transparent", border: "none", width: "calc(100% - 30px)", letterSpacing: "0.2em" }}
          />
        </div>
      </form>

      {error && <div className="error" data-testid="league-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
