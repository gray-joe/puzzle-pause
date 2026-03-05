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

function getTimeBracket(puzzleDate: string, completedAt: string | null): { base: number; label: string } | null {
  if (!completedAt) return null;
  const [year, month, day] = puzzleDate.split("-").map(Number);
  const release = new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
  const solved = new Date(completedAt);
  const diff = Math.max(0, (solved.getTime() - release.getTime()) / 1000);
  const minutes = Math.floor(diff / 60);

  if (minutes <= 10) return { base: 100, label: "under 10 mins" };
  if (minutes <= 30) return { base: 90, label: "10-30 mins" };
  if (minutes <= 60) return { base: 80, label: "30-60 mins" };
  if (minutes <= 120) return { base: 75, label: "1-2 hours" };
  if (minutes <= 180) return { base: 70, label: "2-3 hours" };
  const extraHours = Math.floor((minutes - 180) / 60);
  return { base: 70 - 5 * extraHours, label: "3+ hours" };
}

function formatAnswer(answer: string): string {
  const first = answer.split("|")[0];
  return first.startsWith("~") ? first.slice(1).trim() : first.trim();
}

export default function ResultPanel({ puzzle, attempt, answer, streak, isArchive, isLoggedIn }: Props) {
  const solvedAt = attempt.completed_at ? new Date(attempt.completed_at) : null;
  const completedStr = solvedAt
    ? `${solvedAt.getUTCFullYear()}-${String(solvedAt.getUTCMonth() + 1).padStart(2, "0")}-${String(solvedAt.getUTCDate()).padStart(2, "0")} ${String(solvedAt.getUTCHours()).padStart(2, "0")}:${String(solvedAt.getUTCMinutes()).padStart(2, "0")}:${String(solvedAt.getUTCSeconds()).padStart(2, "0")}`
    : null;

  const rawTimeBracket = getTimeBracket(puzzle.puzzle_date, attempt.completed_at);
  const timeBracket = rawTimeBracket
    ? { base: Math.max(0, rawTimeBracket.base), label: rawTimeBracket.base <= 0 ? "solved after 24h+" : rawTimeBracket.label }
    : null;
  const wrongPenalty = attempt.incorrect_guesses * 5;
  const hintPenalty = attempt.hint_used ? 10 : 0;

  const puzzleName = puzzle.puzzle_name || puzzle.puzzle_type;
  const shareText = isLoggedIn
    ? isArchive
      ? `I scored ${attempt.score} on Puzzle Pause #${puzzle.puzzle_number ?? puzzle.id}! puzzlepause.app/archive/${puzzle.id}`
      : `I scored ${attempt.score} on today's Puzzle Pause! puzzlepause.app`
    : isArchive
      ? `I solved ${puzzleName} on Puzzle Pause! puzzlepause.app/archive/${puzzle.id}`
      : `I solved ${puzzleName} on Puzzle Pause! puzzlepause.app`;

  function share() {
    navigator.clipboard.writeText(shareText).catch(() => { });
  }

  const displayAnswer = answer ? formatAnswer(answer) : null;

  return (
    <div style={{ marginTop: 24 }} data-testid="result-panel">
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
            Hint: {hintPenalty > 0 ? `-${hintPenalty}` : "0"} pts
          </div>

          <hr className="nav-line" />

          <div style={{ color: "var(--teal)", marginBottom: 8 }}>
            Final score: {attempt.score} pts
          </div>
        </div>
      )}

      {displayAnswer && (
        <div style={{ marginBottom: 16 }}>
          The answer was: <span style={{ color: "var(--teal)" }}>{displayAnswer}</span>
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
