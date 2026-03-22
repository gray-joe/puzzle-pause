"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";
import { parseQuestion } from "./parseQuestion";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface ImageWordData { prompt: string; image_url: string; }

export default function ImageWordPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data = parseQuestion<ImageWordData>(puzzle.question);
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
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.image_url}
        alt="puzzle image"
        style={{ width: "100%", display: "block", borderRadius: 8, border: "2px solid var(--border)", aspectRatio: "4 / 3", objectFit: "contain", marginBottom: 12 }}
      />
      {!solved && (
        <form onSubmit={handleSubmit}>
          <div className="action-btn">
            <span className="gt">&gt;</span>
            <input
              type="text"
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
