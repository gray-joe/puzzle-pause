import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordPuzzle from "../WordPuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "word",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: false,
    puzzle_number: 1,
  };
}

describe("WordPuzzle", () => {
  it("renders the question and input", () => {
    const puzzle = makePuzzle("What is 2+2?");
    render(<WordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed value", async () => {
    const onSubmit = vi.fn();
    const puzzle = makePuzzle("Answer?");
    render(<WordPuzzle puzzle={puzzle} solved={false} onSubmit={onSubmit} loading={false} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "  hello  ");

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    await userEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("clears input after submission", async () => {
    const puzzle = makePuzzle("Answer?");
    render(<WordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "test");

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    await userEvent.click(submitBtn);

    expect(input).toHaveValue("");
  });

  it("disables submit when input is empty", () => {
    const puzzle = makePuzzle("Answer?");
    render(<WordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    expect(submitBtn).toBeDisabled();
  });

  it("hides form when solved", () => {
    const puzzle = makePuzzle("Answer?");
    render(<WordPuzzle puzzle={puzzle} solved={true} onSubmit={() => {}} loading={false} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
