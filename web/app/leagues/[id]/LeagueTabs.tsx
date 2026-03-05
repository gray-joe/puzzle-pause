"use client";

import { useState } from "react";
import { LeaderboardEntry, LeagueTags } from "@/lib/api";

const TAG_LABELS: Record<string, string> = {
  guesser: "The Guesser",
  one_shotter: "The One Shotter",
  early_riser: "The Early Riser",
  hint_lover: "The Hint Lover",
};

type Tab = "daily" | "weekly" | "alltime";

const TABS: { key: Tab; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "alltime", label: "All Time" },
];

export default function LeagueTabs({
  leaderboardToday,
  leaderboardWeekly,
  leaderboardAlltime,
  tags,
}: {
  leaderboardToday: LeaderboardEntry[];
  leaderboardWeekly: LeaderboardEntry[];
  leaderboardAlltime: LeaderboardEntry[];
  tags: LeagueTags;
}) {
  const [active, setActive] = useState<Tab>("daily");

  const boards: Record<Tab, LeaderboardEntry[]> = {
    daily: leaderboardToday,
    weekly: leaderboardWeekly,
    alltime: leaderboardAlltime,
  };

  const entries = boards[active];

  // Build a map of user_id → list of tag labels for the active user
  const userTags: Record<number, string[]> = {};
  for (const [key, entry] of Object.entries(tags)) {
    if (entry) {
      if (!userTags[entry.user_id]) userTags[entry.user_id] = [];
      userTags[entry.user_id].push(TAG_LABELS[key] ?? key);
    }
  }

  return (
    <div data-testid="leaderboard-active">
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            data-testid={`leaderboard-tab-${tab.key}`}
            onClick={() => setActive(tab.key)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active === tab.key ? "var(--teal)" : "var(--muted)",
              fontFamily: "inherit",
              fontSize: "1em",
              padding: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="muted">No scores yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Name</th>
              <th style={{ textAlign: "right" }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.user_id}>
                <td className="muted">{e.rank}</td>
                <td>
                  {e.display_name}
                  {userTags[e.user_id] && (
                    <div>
                      {userTags[e.user_id].map((tag) => (
                        <div key={tag} style={{ color: "var(--muted)", fontSize: "0.85em" }}>
                          {tag}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {e.score < 0 ? "—" : e.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
