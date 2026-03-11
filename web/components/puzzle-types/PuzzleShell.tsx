"use client";

import { useState } from "react";
import { Puzzle, AttemptDetail, AttemptResult } from "@/lib/api";
import WordPuzzle from "./WordPuzzle";
import MathPuzzle from "./MathPuzzle";
import LadderPuzzle from "./LadderPuzzle";
import ChoicePuzzle from "./ChoicePuzzle";
import WordsearchPuzzle from "./WordsearchPuzzle";
import OrderPuzzle from "./OrderPuzzle";
import MatchPuzzle from "./MatchPuzzle";
import ConnectionsPuzzle from "./ConnectionsPuzzle";
import ImageTapPuzzle from "./ImageTapPuzzle";
import ImageOrderPuzzle from "./ImageOrderPuzzle";
import ResultPanel from "./ResultPanel";

interface Props {
  puzzle: Puzzle;
  initialAttempt?: AttemptDetail;
  isArchive?: boolean;
  isLoggedIn?: boolean;
  onAttempt: (guess: string, openedAt: string) => Promise<AttemptResult>;
  onHint: () => Promise<string>;
}

export default function PuzzleShell({ puzzle, initialAttempt, isArchive, isLoggedIn, onAttempt, onHint }: Props) {
  const [attempt, setAttempt] = useState<AttemptDetail | undefined>(initialAttempt);
  const [feedback, setFeedback] = useState<string>("");
  const [hint, setHint] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(initialAttempt?.hint_used ?? false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>((puzzle as any).answer ?? null);
  const [streak, setStreak] = useState<number | null>(null);
  const [incorrectGuesses, setIncorrectGuesses] = useState(initialAttempt?.incorrect_guesses ?? 0);
  const [openedAt] = useState(() => initialAttempt?.opened_at ?? new Date().toISOString());

  const solved = attempt?.solved ?? false;

  async function submitGuess(guess: string) {
    if (solved || loading) return;
    setLoading(true);
    setFeedback("");
    try {
      const result = await onAttempt(guess, openedAt);
      if (result.correct) {
        setAttempt({
          solved: true,
          score: result.score,
          incorrect_guesses: incorrectGuesses,
          hint_used: hintUsed,
          completed_at: new Date().toISOString(),
          opened_at: openedAt,
        });
        setAnswer(result.answer ?? null);
        setStreak(result.streak ?? null);
        setFeedback("");
      } else {
        const newCount = incorrectGuesses + 1;
        setIncorrectGuesses(newCount);
        setFeedback(`Wrong. ${newCount} incorrect guess${newCount !== 1 ? "es" : ""}.`);
      }
    } catch (err: any) {
      setFeedback(err.message ?? "Error submitting guess");
    } finally {
      setLoading(false);
    }
  }

  async function revealHint() {
    if (hintUsed || loading) return;
    setLoading(true);
    try {
      const h = await onHint();
      setHint(h);
      setHintUsed(true);
    } catch (err: any) {
      setFeedback(err.message ?? "No hint available");
    } finally {
      setLoading(false);
    }
  }

  const puzzleProps = { puzzle, solved, onSubmit: submitGuess, loading };

  if (solved && attempt) {
    return (
      <div data-testid="puzzle-shell">
        <div className="content-meta" data-testid="puzzle-date">{puzzle.puzzle_date}</div>
        {isArchive && (
          <div className="content-meta muted-dark">
            Archived puzzles are for practice only. No points awarded.
          </div>
        )}
        <ResultPanel
          puzzle={puzzle}
          attempt={attempt}
          answer={answer}
          streak={streak}
          isArchive={isArchive}
          isLoggedIn={isLoggedIn}
        />
      </div>
    );
  }

  return (
    <div data-testid="puzzle-shell">
      <div className="content-meta" data-testid="puzzle-date">{puzzle.puzzle_date}</div>
      <div className="content-meta muted-dark" data-testid="puzzle-instructions">
        {isArchive
          ? "Archived puzzles are for practice only. No points awarded."
          : "Solve within 10 mins for 100 pts, 15 mins for 90, 30 mins for 75, 60 mins for 50. -5 per wrong guess, -10 for a hint."}
      </div>

      <PuzzleTypeRenderer type={puzzle.puzzle_type} {...puzzleProps} />

      <div style={{ marginTop: 8 }}>
        {puzzle.has_hint && !hintUsed && (
          <button className="action-btn secondary" onClick={revealHint} disabled={loading} data-testid="hint-btn">
            <span className="gt">&gt;</span>Reveal hint{!isArchive && <span className="muted"> (-10 pts)</span>}
          </button>
        )}
        {hint && (
          <div className="content-meta" style={{ marginTop: 8 }} data-testid="hint">
            Hint: {hint}
          </div>
        )}
      </div>

      {feedback && (
        <div className="error" style={{ marginTop: 12 }} data-testid="puzzle-feedback">{feedback}</div>
      )}
    </div>
  );
}

function PuzzleTypeRenderer(props: {
  type: string;
  puzzle: Puzzle;
  solved: boolean;
  onSubmit: (guess: string) => void;
  loading: boolean;
}) {
  switch (props.type) {
    case "math": return <MathPuzzle {...props} />;
    case "ladder": return <LadderPuzzle {...props} />;
    case "choice": return <ChoicePuzzle {...props} />;
    case "wordsearch": return <WordsearchPuzzle {...props} />;
    case "order": return <OrderPuzzle {...props} />;
    case "match": return <MatchPuzzle {...props} />;
    case "connections": return <ConnectionsPuzzle {...props} />;
    case "image-tap": return <ImageTapPuzzle {...props} />;
    case "image-order": return <ImageOrderPuzzle {...props} />;
    default: return <WordPuzzle {...props} />;
  }
}
