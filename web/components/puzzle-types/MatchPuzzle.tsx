"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface MatchData { prompt: string; left: string[]; right: string[] }

export default function MatchPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data: MatchData = JSON.parse(puzzle.question);
  // mapping[leftIdx] = rightIdx | null
  const [mapping, setMapping] = useState<(number | null)[]>(() => data.left.map(() => null));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

  function selectLeft(i: number) {
    if (solved) return;
    setSelectedLeft(i === selectedLeft ? null : i);
  }

  function selectRight(j: number) {
    if (solved || selectedLeft === null) return;
    setMapping((prev) => {
      const next = [...prev];
      // Unassign any existing left that points to j
      next.forEach((v, i) => { if (v === j) next[i] = null; });
      next[selectedLeft] = j;
      return next;
    });
    setSelectedLeft(null);
  }

  const rightUsed = new Set(mapping.filter((v) => v !== null) as number[]);

  function handleSubmit() {
    onSubmit(mapping.map((v) => v ?? "").join(","));
  }

  const allMatched = mapping.every((v) => v !== null);

  return (
    <>
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "16px 0" }}>
        <div>
          {data.left.map((item, i) => (
            <button
              key={i}
              className={`action-btn${selectedLeft === i ? " active" : ""}`}
              onClick={() => selectLeft(i)}
              disabled={solved}
              style={{ marginBottom: 8 }}
            >
              <span className="gt">&gt;</span>{" "}{item}
              {mapping[i] !== null && (
                <span style={{ float: "right", color: "var(--teal)" }}>→ {data.right[mapping[i]!]}</span>
              )}
            </button>
          ))}
        </div>
        <div>
          {data.right.map((item, j) => (
            <button
              key={j}
              className={`action-btn${rightUsed.has(j) ? " active" : ""}${selectedLeft !== null ? "" : ""}`}
              onClick={() => selectRight(j)}
              disabled={solved || selectedLeft === null}
              style={{ marginBottom: 8 }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {!solved && (
        <button className="action-btn" onClick={handleSubmit} disabled={loading || !allMatched} data-testid="submit-btn">
          <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit Matches"}
        </button>
      )}
    </>
  );
}
