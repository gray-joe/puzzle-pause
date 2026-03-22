import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageWordPuzzle from "../ImageWordPuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "image-word",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: false,
    puzzle_number: 1,
  };
}

const VALID_QUESTION = JSON.stringify({ prompt: "What is shown?", image_url: "/test.jpg" });

describe("ImageWordPuzzle", () => {
  it("renders the prompt and image", () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("What is shown?");
    expect(screen.getByRole("img", { name: "puzzle image" })).toHaveAttribute("src", "/test.jpg");
  });

  it("renders the text input", () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed value", async () => {
    const onSubmit = vi.fn();
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={onSubmit} loading={false} />);

    await userEvent.type(screen.getByRole("textbox"), "  C  ");
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));

    expect(onSubmit).toHaveBeenCalledWith("C");
  });

  it("clears input after submission", async () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "answer");
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));

    expect(input).toHaveValue("");
  });

  it("disables submit when input is empty", () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
  });

  it("hides form when solved", () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={true} onSubmit={() => {}} loading={false} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("still shows image when solved", () => {
    const puzzle = makePuzzle(VALID_QUESTION);
    render(<ImageWordPuzzle puzzle={puzzle} solved={true} onSubmit={() => {}} loading={false} />);

    expect(screen.getByRole("img", { name: "puzzle image" })).toBeInTheDocument();
  });

  it("shows error for invalid question JSON", () => {
    const puzzle = makePuzzle("not valid json");
    render(<ImageWordPuzzle puzzle={puzzle} solved={false} onSubmit={() => {}} loading={false} />);

    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("Invalid puzzle data.");
  });
});
