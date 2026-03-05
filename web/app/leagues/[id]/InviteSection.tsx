"use client";

export default function InviteSection({ inviteCode }: { inviteCode: string }) {
  const inviteUrl = `https://puzzlepause.app/leagues/join?code=${inviteCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div>
        Invite code: <strong data-testid="league-invite-code">{inviteCode}</strong>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>{inviteUrl}</div>
      <button
        className="action-btn"
        data-testid="copy-link-btn"
        onClick={handleCopy}
        style={{ marginTop: 8 }}
      >
        Copy link
      </button>
    </div>
  );
}
