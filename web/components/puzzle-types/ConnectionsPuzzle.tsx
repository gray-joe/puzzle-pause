"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface ConnectionsData { prompt: string; items: string[]; categories: string[] }

const CATEGORY_COLORS = ["var(--teal)", "var(--orange)", "#a29bfe", "#fd79a8"];

export default function ConnectionsPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data: ConnectionsData = JSON.parse(puzzle.question);
  // groups[categoryIdx] = Set of item indices
  const [groups, setGroups] = useState<Set<number>[]>(() => data.categories.map(() => new Set<number>()));
  const [selectedCategory, setSelectedCategory] = useState<number>(0);

  function toggleItem(itemIdx: number) {
    if (solved) return;
    setGroups((prev) => {
      const next = prev.map((s) => new Set(s));
      // Remove from any current group
      next.forEach((s) => s.delete(itemIdx));
      // Add to selected category
      next[selectedCategory].add(itemIdx);
      return next;
    });
  }

  function getItemCategory(itemIdx: number): number | null {
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].has(itemIdx)) return i;
    }
    return null;
  }

  function handleSubmit() {
    const answer = groups.map((g) => Array.from(g).sort((a, b) => a - b).join(",")).join("|");
    onSubmit(answer);
  }

  const allAssigned = data.items.every((_, i) => getItemCategory(i) !== null);

  return (
    <>
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>

      {/* Category selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {data.categories.map((cat, i) => (
          <button
            key={i}
            onClick={() => setSelectedCategory(i)}
            style={{
              background: "transparent",
              border: `2px solid ${selectedCategory === i ? CATEGORY_COLORS[i] : "var(--border)"}`,
              color: CATEGORY_COLORS[i],
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
              borderRadius: 6,
            }}
          >
            {cat} ({groups[i].size})
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {data.items.map((item, i) => {
          const cat = getItemCategory(i);
          const color = cat !== null ? CATEGORY_COLORS[cat] : "var(--border)";
          return (
            <button
              key={i}
              onClick={() => toggleItem(i)}
              disabled={solved}
              style={{
                background: "transparent",
                border: `2px solid ${color}`,
                color: cat !== null ? color : "var(--text)",
                padding: "10px 8px",
                cursor: solved ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {item}
            </button>
          );
        })}
      </div>

      {!solved && (
        <button className="action-btn" onClick={handleSubmit} disabled={loading || !allAssigned} data-testid="submit-btn">
          <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit Groups"}
        </button>
      )}
    </>
  );
}
