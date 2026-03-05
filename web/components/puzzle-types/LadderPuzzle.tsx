"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

function parseSteps(question: string) {
  return question.split(",").map((s) => s.trim());
}

export default function LadderPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const steps = parseSteps(puzzle.question);
  const blanks = steps.reduce<number[]>((acc, s, i) => (s === "____" ? [...acc, i] : acc), []);
  const [guesses, setGuesses] = useState<Record<number, string>>({});

  function setGuess(i: number, val: string) {
    setGuesses((prev) => ({ ...prev, [i]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answer = blanks.map((i) => guesses[i] ?? "").join(", ");
    onSubmit(answer);
  }

  return (
    <>
      <div className="puzzle-box" data-testid="puzzle-question" style={{ flexDirection: "column", gap: 8 }}>
        {steps.map((step, i) =>
          step === "____" ? (
            <span key={i} style={{ color: "var(--teal)", borderBottom: "2px solid var(--teal)", minWidth: 80, display: "inline-block", textAlign: "center" }}>
              {guesses[i] || "____"}
            </span>
          ) : (
            <span key={i}>{step}</span>
          )
        )}
      </div>
      {!solved && (
        <form onSubmit={handleSubmit}>
          {blanks.map((blankIdx) => (
            <div key={blankIdx} className="action-btn">
              <span className="gt">&gt;</span>
              <input
                type="text"
                value={guesses[blankIdx] ?? ""}
                onChange={(e) => setGuess(blankIdx, e.target.value)}
                placeholder={`Step ${blankIdx + 1}...`}
                disabled={loading}
                data-testid="answer-input"
                style={{ background: "transparent", border: "none", width: "calc(100% - 30px)" }}
              />
            </div>
          ))}
          <button type="submit" className="action-btn" disabled={loading || blanks.some((i) => !guesses[i]?.trim())} data-testid="submit-btn">
            <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit"}
          </button>
        </form>
      )}
    </>
  );
}
