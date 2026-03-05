import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChoicePuzzle from "../ChoicePuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "choice",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: false,
    puzzle_number: 1,
  };
}

describe("parseChoice (via render)", () => {
  it("splits prompt and options from pipe-delimited question", () => {
    const puzzle = makePuzzle("What color?|Red|Blue|Green");
    render(<ChoicePuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByText("What color?")).toBeInTheDocument();
    expect(screen.getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText(/Blue/)).toBeInTheDocument();
    expect(screen.getByText(/Green/)).toBeInTheDocument();
  });

  it("renders correct letter labels (A, B, C...)", () => {
    const puzzle = makePuzzle("Pick one|Alpha|Beta");
    render(<ChoicePuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("A");
    expect(buttons[1]).toHaveTextContent("B");
  });
});

describe("interaction", () => {
  it("calls onSubmit with correct letter on click", async () => {
    const onSubmit = vi.fn();
    const puzzle = makePuzzle("Pick|X|Y|Z");
    render(<ChoicePuzzle puzzle={puzzle} solved={false} onSubmit={onSubmit} loading={false} />);

    // Click the second option (B = "Y")
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);

    expect(onSubmit).toHaveBeenCalledWith("B");
  });

  it("disables buttons when solved", () => {
    const puzzle = makePuzzle("Pick|X|Y");
    render(<ChoicePuzzle puzzle={puzzle} solved={true} onSubmit={() => {}} loading={false} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disables buttons when loading", () => {
    const puzzle = makePuzzle("Pick|X|Y");
    render(<ChoicePuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={true} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });
});
