import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LadderPuzzle from "../LadderPuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "ladder",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: false,
    puzzle_number: 1,
  };
}

describe("parseSteps (via render)", () => {
  it("splits and trims comma-separated steps", () => {
    const puzzle = makePuzzle("cat,  ____, bat");
    render(<LadderPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByText("cat")).toBeInTheDocument();
    expect(screen.getByText("bat")).toBeInTheDocument();
  });

  it("identifies blank indices from ____ markers", () => {
    const puzzle = makePuzzle("start, ____, middle, ____, end");
    render(<LadderPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    // Two blanks → two text inputs
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
  });
});

describe("submission", () => {
  it("submits comma-joined answers for blanks", async () => {
    const onSubmit = vi.fn();
    const puzzle = makePuzzle("start, ____, ____");
    render(<LadderPuzzle puzzle={puzzle} solved={false} onSubmit={onSubmit} loading={false} />);

    const inputs = screen.getAllByRole("textbox");
    await userEvent.type(inputs[0], "foo");
    await userEvent.type(inputs[1], "bar");

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    await userEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith("foo, bar");
  });

  it("disables submit when blanks are empty", () => {
    const puzzle = makePuzzle("start, ____");
    render(<LadderPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    expect(submitBtn).toBeDisabled();
  });

  it("hides form when solved", () => {
    const puzzle = makePuzzle("start, ____");
    render(<LadderPuzzle puzzle={puzzle} solved={true} onSubmit={() => {}} loading={false} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
