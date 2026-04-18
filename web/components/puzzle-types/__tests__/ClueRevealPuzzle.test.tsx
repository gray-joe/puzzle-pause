import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClueRevealPuzzle from "../ClueRevealPuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "clue-reveal",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: true,
    puzzle_number: 1,
  };
}

const VALID_QUESTION = JSON.stringify({
  prompt: "Who am I?",
  clues: ["Born in 1564"],
});

const THREE_CLUE_QUESTION = JSON.stringify({
  prompt: "Who am I?",
  clues: ["Born in 1564"],
});

const HINT_TWO_CLUES = "Wrote Hamlet|Wrote Romeo and Juliet";

describe("ClueRevealPuzzle", () => {
  it("renders the prompt", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("Who am I?");
  });

  it("renders the first clue always", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByTestId("clue-0")).toHaveTextContent("Born in 1564");
  });

  it("shows no additional clues when hintsRevealed is 0", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(THREE_CLUE_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={HINT_TWO_CLUES}
        hintsRevealed={0}
      />
    );
    expect(screen.queryByTestId("clue-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clue-2")).not.toBeInTheDocument();
  });

  it("shows one additional clue when hintsRevealed is 1", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(THREE_CLUE_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={HINT_TWO_CLUES}
        hintsRevealed={1}
      />
    );
    expect(screen.getByTestId("clue-1")).toHaveTextContent("Wrote Hamlet");
    expect(screen.queryByTestId("clue-2")).not.toBeInTheDocument();
  });

  it("shows all additional clues when fully revealed", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(THREE_CLUE_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={HINT_TWO_CLUES}
        hintsRevealed={2}
      />
    );
    expect(screen.getByTestId("clue-1")).toHaveTextContent("Wrote Hamlet");
    expect(screen.getByTestId("clue-2")).toHaveTextContent("Wrote Romeo and Juliet");
  });

  it("renders numbered clue labels", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(THREE_CLUE_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={HINT_TWO_CLUES}
        hintsRevealed={2}
      />
    );
    expect(screen.getByTestId("clue-0")).toHaveTextContent("#1");
    expect(screen.getByTestId("clue-1")).toHaveTextContent("#2");
    expect(screen.getByTestId("clue-2")).toHaveTextContent("#3");
  });

  it("renders the answer input", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByTestId("answer-input")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed value", async () => {
    const onSubmit = vi.fn();
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={onSubmit}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    await userEvent.type(screen.getByTestId("answer-input"), "  Shakespeare  ");
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));
    expect(onSubmit).toHaveBeenCalledWith("Shakespeare");
  });

  it("clears input after submission", async () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    const input = screen.getByTestId("answer-input");
    await userEvent.type(input, "answer");
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));
    expect(input).toHaveValue("");
  });

  it("disables submit when input is empty", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
  });

  it("hides form when solved", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={true}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.queryByTestId("answer-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("still shows clues when solved", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle(VALID_QUESTION)}
        solved={true}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByTestId("clue-0")).toBeInTheDocument();
  });

  it("shows error for invalid question JSON", () => {
    render(
      <ClueRevealPuzzle
        puzzle={makePuzzle("not valid json")}
        solved={false}
        onSubmit={() => {}}
        loading={false}
        hint={null}
        hintsRevealed={0}
      />
    );
    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("Invalid puzzle data.");
  });
});
