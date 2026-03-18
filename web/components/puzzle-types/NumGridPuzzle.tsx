"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";
import { parseQuestion } from "./parseQuestion";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface GridData { prompt: string; grid: (number | null)[] }

export default function NumGridPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data = parseQuestion<GridData>(puzzle.question);
  const [guess, setGuess] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    onSubmit(guess.trim());
    setGuess("");
  }

  if (!data) return <div className="error" data-testid="puzzle-question">Invalid puzzle data.</div>;

  return (
    <>
      <div className="puzzle-prompt" data-testid="puzzle-question">{data.prompt}</div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        margin: "16px 0",
        maxWidth: 280,
      }}>
        {data.grid.map((cell, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${cell === null ? "var(--teal)" : "var(--border)"}`,
              borderRadius: 4,
              padding: "12px 0",
              textAlign: "center",
              fontSize: "1.1em",
              color: cell === null ? "var(--teal)" : "inherit",
              background: cell === null ? "rgba(78,204,163,0.08)" : "transparent",
            }}
          >
            {cell === null ? "?" : cell}
          </div>
        ))}
      </div>

      {!solved && (
        <form onSubmit={handleSubmit}>
          <div className="action-btn">
            <span className="gt">&gt;</span>
            <input
              type="text"
              inputMode="numeric"
              value={guess}
              onChange={(e) => { if (/^-?\d*\.?\d*$/.test(e.target.value)) setGuess(e.target.value); }}
              placeholder="Missing number..."
              disabled={loading}
              autoFocus
              data-testid="answer-input"
              style={{ background: "transparent", border: "none", width: "calc(100% - 30px)" }}
            />
          </div>
          <button type="submit" className="action-btn" disabled={loading || !guess.trim()} data-testid="submit-btn">
            <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit"}
          </button>
        </form>
      )}
    </>
  );
}
