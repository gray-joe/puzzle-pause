"use client";

import Link from "next/link";
import { Puzzle, AttemptDetail } from "@/lib/api";

interface Props {
  puzzle: Puzzle;
  attempt: AttemptDetail;
  answer: string | null;
  streak?: number | null;
  isArchive?: boolean;
  isLoggedIn?: boolean;
}

function getTimeBracket(openedAt: string | null, completedAt: string | null): { base: number; label: string } | null {
  if (!openedAt || !completedAt) return null;
  const diff = Math.max(0, (new Date(completedAt).getTime() - new Date(openedAt).getTime()) / 1000);
  const minutes = Math.floor(diff / 60);

  if (minutes <= 10) return { base: 100, label: "under 10 mins" };
  if (minutes <= 15) return { base: 90, label: "10-15 mins" };
  if (minutes <= 30) return { base: 75, label: "15-30 mins" };
  if (minutes <= 60) return { base: 50, label: "30-60 mins" };
  return { base: 30, label: "over 60 mins" };
}

function formatDuration(openedAt: string | null | undefined, completedAt: string | null): string | null {
  if (!openedAt || !completedAt) return null;
  const seconds = Math.max(0, Math.floor((new Date(completedAt).getTime() - new Date(openedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatAnswers(answer: string): string[] {
  return answer
    .split("|")
    .map((a) => (a.startsWith("~") ? a.slice(1).trim() : a.trim()))
    .filter(Boolean);
}

function formatOrderAnswer(answer: string, question: string): string[] | null {
  try {
    const { items } = JSON.parse(question) as { items: string[] };
    return answer.split(",").map((idx) => items[Number(idx)]).filter(Boolean);
  } catch {
    return null;
  }
}

function formatConnectionsAnswer(answer: string, question: string): { category: string; items: string[] }[] | null {
  try {
    const { items, categories } = JSON.parse(question) as { items: string[]; categories?: string[] };
    return answer.split("|").map((group, i) => ({
      category: categories?.[i] ?? `Group ${i + 1}`,
      items: group.split(",").map((idx) => items[Number(idx)]).filter(Boolean),
    }));
  } catch {
    return null;
  }
}

export default function ResultPanel({ puzzle, attempt, answer, streak, isArchive, isLoggedIn }: Props) {
  const solvedAt = attempt.completed_at ? new Date(attempt.completed_at) : null;
  const completedStr = solvedAt
    ? `${solvedAt.getUTCFullYear()}-${String(solvedAt.getUTCMonth() + 1).padStart(2, "0")}-${String(solvedAt.getUTCDate()).padStart(2, "0")} ${String(solvedAt.getUTCHours()).padStart(2, "0")}:${String(solvedAt.getUTCMinutes()).padStart(2, "0")}:${String(solvedAt.getUTCSeconds()).padStart(2, "0")}`
    : null;

  const rawTimeBracket = getTimeBracket(attempt.opened_at ?? null, attempt.completed_at);
  const timeBracket = rawTimeBracket
    ? { base: Math.max(0, rawTimeBracket.base), label: rawTimeBracket.base <= 0 ? "solved after 24h+" : rawTimeBracket.label }
    : null;
  const wrongPenalty = attempt.incorrect_guesses * 5;
  const hintPenalty = attempt.hint_used * 10;

  const puzzleName = puzzle.puzzle_name || puzzle.puzzle_type;
  const duration = formatDuration(attempt.opened_at, attempt.completed_at);
  const timeStr = duration ? ` in ${duration}` : "";
  const shareText = isLoggedIn
    ? isArchive
      ? `I scored ${attempt.score} on Puzzle Pause #${puzzle.puzzle_number ?? puzzle.id}${timeStr}! puzzlepause.app/archive/${puzzle.id}`
      : `I scored ${attempt.score} on today's Puzzle Pause${timeStr}! puzzlepause.app`
    : isArchive
      ? `I solved ${puzzleName} on Puzzle Pause! puzzlepause.app/archive/${puzzle.id}`
      : `I solved ${puzzleName} on Puzzle Pause${timeStr}! puzzlepause.app`;

  function share() {
    navigator.clipboard.writeText(shareText).catch(() => { });
  }

  const isOrderPuzzle = puzzle.puzzle_type === "order";
  const isConnectionsPuzzle = puzzle.puzzle_type === "connections";
  const connectionsGroups = isConnectionsPuzzle && answer ? formatConnectionsAnswer(answer, puzzle.question) : null;
  const displayAnswers = answer
    ? isOrderPuzzle
      ? (formatOrderAnswer(answer, puzzle.question) ?? formatAnswers(answer))
      : formatAnswers(answer)
    : [];

  return (
    <div style={{ marginTop: 24 }} data-testid="result-panel">
      {connectionsGroups ? (
        <div style={{ marginBottom: 16 }} data-testid="result-answer">
          <div style={{ marginBottom: 8 }}>Congratulations! The groups were:</div>
          {connectionsGroups.map((group, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: "var(--teal)" }}>{group.category}:</span>{" "}
              {group.items.join(", ")}
            </div>
          ))}
        </div>
      ) : displayAnswers.length > 0 && (
        <div style={{ marginBottom: 16 }} data-testid="result-answer">
          Congratulations! The correct {isOrderPuzzle ? "order" : "answer"} was{" "}
          <span style={{ color: "var(--teal)" }}>
            {isOrderPuzzle
              ? displayAnswers.map((item, i) => (
                  <span key={i}>{i + 1}. {item}{i < displayAnswers.length - 1 ? ", " : ""}</span>
                ))
              : displayAnswers.join(", ")}
          </span>
        </div>
      )}

      {/* Score box */}
      <div className="puzzle-box" style={{ flexDirection: "column" }}>
        <div style={{ fontSize: "3em", color: "var(--teal)", fontWeight: "bold" }} data-testid="result-score">
          {attempt.score}
        </div>
        <div className="muted">points</div>
      </div>

      {isLoggedIn && (
        <div style={{ marginTop: 16 }}>
          {completedStr && (
            <div className="muted" style={{ marginBottom: 8 }}>Completed: {completedStr}</div>
          )}
          {timeBracket && (
            <div className="muted" style={{ marginBottom: 8 }}>
              Time bonus: {timeBracket.base} pts ({timeBracket.label})
            </div>
          )}
          <div className="muted" style={{ marginBottom: 8 }}>
            Wrong guesses: {wrongPenalty > 0 ? `-${wrongPenalty}` : "0"} pts
          </div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Hints: {hintPenalty > 0 ? `-${hintPenalty}` : "0"} pts
          </div>

          <hr className="nav-line" />

          <div style={{ color: "var(--teal)", marginBottom: 8 }}>
            Final score: {attempt.score} pts
          </div>
        </div>
      )}

      {!isArchive && streak != null && streak > 0 && (
        <div style={{ color: "var(--teal)", marginBottom: 16 }} data-testid="result-streak">
          Streak: {streak} day{streak !== 1 ? "s" : ""}
        </div>
      )}

      {!isLoggedIn && (
        <div className="muted" style={{ marginBottom: 16 }}>
          <Link href="/login">Log in</Link> to save your scores and compete in leagues.
        </div>
      )}

      <button className="action-btn" onClick={share} data-testid="share-btn">
        <span className="gt">&gt;</span>Share result
      </button>

      {isLoggedIn && !isArchive && (
        <Link href="/leagues" className="action-btn" style={{ display: "block", marginTop: 0 }}>
          <span className="gt">&gt;</span>View Leagues
        </Link>
      )}

      {!isLoggedIn && (
        <Link href="/login" className="action-btn" style={{ display: "block", marginTop: 0 }}>
          <span className="gt">&gt;</span>Login
        </Link>
      )}
    </div>
  );
}
