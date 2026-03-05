"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function AccountActions({ displayName, email }: { displayName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setSaved(false);
    try {
      await api.account.update(name.trim());
      setSaved(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally { setLoading(false); }
  }

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <div className="muted" style={{ marginBottom: 8 }}>Display Name</div>
      <form onSubmit={handleSave}>
        <div className="action-btn">
          <span className="gt">&gt;</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name..."
            maxLength={40}
            data-testid="display-name-input"
            style={{ background: "transparent", border: "none", width: "calc(100% - 30px)" }}
          />
        </div>
        <button type="submit" className="action-btn" disabled={loading} data-testid="save-name-btn">
          <span className="gt">&gt;</span>{loading ? "Saving..." : "Save"}
        </button>
      </form>
      {saved && <div className="success" style={{ marginTop: 8 }} data-testid="save-success">Saved.</div>}
      {error && <div className="error" style={{ marginTop: 8 }} data-testid="save-error">{error}</div>}

      <div style={{ marginTop: 24 }}>
        <div className="muted" style={{ marginBottom: 4 }}>Email</div>
        <div data-testid="account-email">{email}</div>
      </div>

      <button className="action-btn" onClick={handleLogout} style={{ marginTop: 16 }} data-testid="logout-btn">
        <span className="gt">&gt;</span>Logout
      </button>
    </div>
  );
}
