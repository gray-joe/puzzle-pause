"use client";

import { useState } from "react";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

function parseChoice(question: string) {
  const parts = question.split("|");
  return { prompt: parts[0], options: parts.slice(1) };
}

const LETTERS = "ABCDEFGHIJ";

export default function ChoicePuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const { prompt, options } = parseChoice(puzzle.question);
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(i: number) {
    if (solved || loading) return;
    setSelected(i);
    onSubmit(LETTERS[i]);
  }

  return (
    <>
      <div className="puzzle-box" data-testid="puzzle-question">
        <div style={{ fontSize: "1.1em" }}>{prompt}</div>
      </div>
      <div>
        {options.map((opt, i) => (
          <button
            key={i}
            className={`choice-option${selected === i ? " selected" : ""}`}
            onClick={() => handleSelect(i)}
            disabled={solved || loading}
          >
            <span className="gt">{LETTERS[i]}</span>{"  "}{opt}
          </button>
        ))}
      </div>
    </>
  );
}
