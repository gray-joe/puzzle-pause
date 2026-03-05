"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.login(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.verify(email, code);
      router.push("/puzzle");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title"><span className="gt">&gt;</span>Login</div>
        <hr className="nav-line" />
      </div>

      {!sent ? (
        <>
          <div className="content-meta" data-testid="login-meta">
            Enter your email to receive a login code.<br />
            No password required.
          </div>
          <form onSubmit={handleLogin} data-testid="login-form">
            <div className="action-btn">
              <span className="gt">&gt;</span>
              <input
                data-testid="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ background: "transparent", border: "none", width: "calc(100% - 30px)" }}
              />
            </div>
            <button data-testid="send-code-btn" type="submit" className="action-btn" disabled={loading}>
              <span className="gt">&gt;</span>{loading ? "Sending..." : "Send Code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="content-meta" data-testid="verify-meta">
            Code sent to <span style={{ color: "var(--teal)" }}>{email}</span>.<br />
            Enter the 6-character code from your email.
          </div>
          <form onSubmit={handleVerify} data-testid="verify-form">
            <div className="action-btn">
              <span className="gt">&gt;</span>
              <input
                data-testid="code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                required
                style={{ background: "transparent", border: "none", width: "calc(100% - 30px)", letterSpacing: "0.3em" }}
              />
            </div>
            <button data-testid="verify-btn" type="submit" className="action-btn" disabled={loading}>
              <span className="gt">&gt;</span>{loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>
          <button
            data-testid="change-email-btn"
            className="action-btn secondary"
            onClick={() => { setSent(false); setCode(""); setError(""); }}
            style={{ marginTop: 8 }}
          >
            <span className="gt">&gt;</span>Use a different email
          </button>
        </>
      )}

      {error && <div className="error" data-testid="login-error" style={{ marginTop: 16 }}>{error}</div>}
    </>
  );
}
