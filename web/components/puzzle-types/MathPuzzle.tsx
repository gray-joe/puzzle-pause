"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

export default function MathPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const [guess, setGuess] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    onSubmit(guess.trim());
    setGuess("");
  }

  return (
    <>
      <div className="puzzle-box" data-testid="puzzle-question">
        <div style={{ fontSize: "1.2em", letterSpacing: "0.05em" }}>{puzzle.question}</div>
      </div>
      {!solved && (
        <form onSubmit={handleSubmit}>
          <div className="action-btn">
            <span className="gt">&gt;</span>
            <input
              type="text"
              inputMode="numeric"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Your answer..."
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
