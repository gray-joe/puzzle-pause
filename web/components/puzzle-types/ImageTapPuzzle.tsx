"use client";

import { useState, useRef } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface ImageTapData { prompt: string; image_url: string; target?: { x: number; y: number; radius: number } }

export default function ImageTapPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data: ImageTapData = JSON.parse(puzzle.question);
  const [tapped, setTapped] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    if (solved || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTapped({ x, y });
  }

  function handleSubmit() {
    if (!tapped) return;
    onSubmit(`${tapped.x.toFixed(4)},${tapped.y.toFixed(4)}`);
  }

  return (
    <>
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>
      <div
        onClick={handleTap}
        style={{ position: "relative", cursor: solved ? "default" : "crosshair", marginBottom: 12 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={data.image_url}
          alt="puzzle image"
          style={{ width: "100%", display: "block", borderRadius: 8, border: "2px solid var(--border)" }}
        />
        {tapped && !solved && (
          <div
            style={{
              position: "absolute",
              left: `${tapped.x * 100}%`,
              top: `${tapped.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "3px solid var(--teal)",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Show target after solving */}
        {solved && data.target && (
          <div
            style={{
              position: "absolute",
              left: `${data.target.x * 100}%`,
              top: `${data.target.y * 100}%`,
              transform: "translate(-50%, -50%)",
              width: `${data.target.radius * 200}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              border: "3px solid var(--teal)",
              background: "rgba(78, 204, 163, 0.2)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {tapped && !solved && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Tapped: ({(tapped.x * 100).toFixed(1)}%, {(tapped.y * 100).toFixed(1)}%)
        </div>
      )}
      {!solved && (
        <button className="action-btn" onClick={handleSubmit} disabled={loading || !tapped} data-testid="submit-btn">
          <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit Tap"}
        </button>
      )}
    </>
  );
}
