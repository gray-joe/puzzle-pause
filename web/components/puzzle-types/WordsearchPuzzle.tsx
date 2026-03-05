"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

export default function WordsearchPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const [guess, setGuess] = useState("");

  // question format: "grid_rows\nFind: WORD"
  const lines = puzzle.question.split("\n");
  const findLine = lines.find((l) => l.startsWith("Find:") || l.startsWith("find:"));
  const gridLines = lines.filter((l) => !l.startsWith("Find:") && !l.startsWith("find:") && l.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    onSubmit(guess.trim());
    setGuess("");
  }

  return (
    <>
      <div className="puzzle-box" data-testid="puzzle-question" style={{ flexDirection: "column" }}>
        {gridLines.length > 0 ? (
          <pre style={{ fontFamily: "inherit", margin: 0, letterSpacing: "0.3em", lineHeight: 1.8, color: "var(--text)" }}>
            {gridLines.join("\n")}
          </pre>
        ) : (
          <div style={{ fontSize: "1.1em" }}>{puzzle.question}</div>
        )}
        {findLine && (
          <div style={{ marginTop: 12, color: "var(--teal)" }}>{findLine}</div>
        )}
      </div>
      {!solved && (
        <form onSubmit={handleSubmit}>
          <div className="action-btn">
            <span className="gt">&gt;</span>
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value.toUpperCase())}
              placeholder="Found word..."
              disabled={loading}
              autoFocus
              data-testid="answer-input"
              style={{ background: "transparent", border: "none", width: "calc(100% - 30px)", letterSpacing: "0.1em" }}
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
