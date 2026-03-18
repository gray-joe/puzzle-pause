"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";
import { parseQuestion } from "./parseQuestion";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface ScrabbleData {
  prompt: string;
  board: (string | null)[];
  modifiers?: (string | null)[];
  rack: string[];
}

const MODIFIER_STYLES: Record<string, { border: string; background: string; label: string }> = {
  dl: { border: "#87CEEB", background: "rgba(135,206,235,0.12)", label: "DL" },
  tl: { border: "#4169E1", background: "rgba(65,105,225,0.12)", label: "TL" },
  dw: { border: "#FF8C69", background: "rgba(255,140,105,0.12)", label: "DW" },
  tw: { border: "#E63946", background: "rgba(230,57,70,0.12)",  label: "TW" },
};

const DEFAULT_TILE = { border: "var(--teal)", background: "rgba(78,204,163,0.08)" };

export default function ScrabblePuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data = parseQuestion<ScrabbleData>(puzzle.question);
  const [guess, setGuess] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    onSubmit(guess.trim());
    setGuess("");
  }

  const tileStyle = (mod: string | null | undefined): React.CSSProperties => {
    const m = mod && MODIFIER_STYLES[mod];
    return {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: `2px solid ${m ? m.border : DEFAULT_TILE.border}`,
      borderRadius: 4,
      padding: "6px 10px",
      margin: 2,
      minWidth: 36,
      minHeight: 44,
      fontSize: "1.2em",
      background: m ? m.background : DEFAULT_TILE.background,
      position: "relative",
    };
  };

  if (!data) return <div className="error" data-testid="puzzle-question">Invalid puzzle data.</div>;

  return (
    <>
      <div className="puzzle-prompt" data-testid="puzzle-question">{data.prompt}</div>

      {/* Board row */}
      <div style={{ margin: "16px 0 8px", display: "flex", flexWrap: "wrap" }}>
        {data.board.map((cell, i) => {
          const mod = data.modifiers?.[i] ?? null;
          const modInfo = mod ? MODIFIER_STYLES[mod] : null;
          return (
            <div key={i} style={tileStyle(mod)}>
              {cell ?? "_"}
              {modInfo && (
                <span style={{ fontSize: "0.4em", color: modInfo.border, lineHeight: 1, marginTop: 2 }}>
                  {modInfo.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rack */}
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap" }}>
        {data.rack.map((letter, i) => (
          <div key={i} style={tileStyle(null)}>{letter}</div>
        ))}
      </div>

      {/* Legend */}
      {data.modifiers?.some(Boolean) && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(MODIFIER_STYLES).map(([key, val]) =>
            data.modifiers!.includes(key) ? (
              <span key={key} style={{ fontSize: "0.8em", color: val.border }}>
                {val.label} = {key === "dl" ? "Double Letter" : key === "tl" ? "Triple Letter" : key === "dw" ? "Double Word" : "Triple Word"}
              </span>
            ) : null
          )}
        </div>
      )}

      {!solved && (
        <form onSubmit={handleSubmit}>
          <div className="action-btn">
            <span className="gt">&gt;</span>
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="word score (e.g. mask 10)"
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
