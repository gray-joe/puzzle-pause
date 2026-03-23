import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CountdownPuzzle from "../CountdownPuzzle";
import { Puzzle } from "@/lib/api";

afterEach(cleanup);

function makePuzzle(question: string): Puzzle {
  return {
    id: 1,
    puzzle_date: "2026-01-01",
    puzzle_type: "countdown",
    puzzle_name: "Test",
    question,
    hint: null,
    has_hint: false,
    puzzle_number: 1,
  };
}

const VALID_QUESTION = JSON.stringify({
  prompt: "Reach the target!",
  target: 81,
  numbers: [75, 6, 4, 3, 2, 1],
  operators: ["+", "-"],
});

describe("CountdownPuzzle rendering", () => {
  it("renders the prompt", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("Reach the target!");
  });

  it("renders the target number in its own box", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("target-number")).toHaveTextContent("81");
  });

  it("renders all number tiles", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("number-tile-0")).toHaveTextContent("75");
    expect(screen.getByTestId("number-tile-1")).toHaveTextContent("6");
    expect(screen.getByTestId("number-tile-2")).toHaveTextContent("4");
    expect(screen.getByTestId("number-tile-3")).toHaveTextContent("3");
    expect(screen.getByTestId("number-tile-4")).toHaveTextContent("2");
    expect(screen.getByTestId("number-tile-5")).toHaveTextContent("1");
  });

  it("renders all operator tiles", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("operator-tile-0")).toHaveTextContent("+");
    expect(screen.getByTestId("operator-tile-1")).toHaveTextContent("-");
  });

  it("renders bracket tiles", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("bracket-tile-(")).toBeInTheDocument();
    expect(screen.getByTestId("bracket-tile-)")).toBeInTheDocument();
  });

  it("shows error for invalid JSON", () => {
    render(<CountdownPuzzle puzzle={makePuzzle("bad json")} solved={false} onSubmit={() => {}} loading={false} />);
    expect(screen.getByTestId("puzzle-question")).toHaveTextContent("Invalid puzzle data.");
  });
});

describe("CountdownPuzzle expression building", () => {
  it("adds number token when tile is clicked", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0"));
    expect(screen.getByTestId("expression-display")).toHaveTextContent("75");
  });

  it("disables a number tile after it is used", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0"));
    expect(screen.getByTestId("number-tile-0")).toBeDisabled();
  });

  it("adds operator token when tile is clicked", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0"));
    await userEvent.click(screen.getByTestId("operator-tile-0"));
    expect(screen.getByTestId("expression-display")).toHaveTextContent("75 +");
  });

  it("operator tiles are never disabled", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("operator-tile-0"));
    await userEvent.click(screen.getByTestId("operator-tile-0"));
    expect(screen.getByTestId("operator-tile-0")).not.toBeDisabled();
  });

  it("bracket tiles add to expression and are never disabled", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("bracket-tile-("));
    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    await userEvent.click(screen.getByTestId("bracket-tile-)"));
    expect(screen.getByTestId("expression-display")).toHaveTextContent("( 75 )");
    expect(screen.getByTestId("bracket-tile-(")).not.toBeDisabled();
    expect(screen.getByTestId("bracket-tile-)")).not.toBeDisabled();
  });

  it("expression with brackets evaluates correctly", async () => {
    // ( 6 + 1 ) = 7
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("bracket-tile-("));
    await userEvent.click(screen.getByTestId("number-tile-1")); // 6
    await userEvent.click(screen.getByTestId("operator-tile-0")); // +
    await userEvent.click(screen.getByTestId("number-tile-5")); // 1
    await userEvent.click(screen.getByTestId("bracket-tile-)"));
    await userEvent.click(screen.getByTestId("show-total-btn"));
    expect(screen.getByTestId("expression-result")).toHaveTextContent("= 7");
  });

  it("backspace over a bracket does not affect number tiles", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    await userEvent.click(screen.getByTestId("operator-tile-0")); // +
    await userEvent.click(screen.getByTestId("bracket-tile-("));

    await userEvent.click(screen.getByRole("button", { name: /Backspace/ }));
    expect(screen.getByTestId("number-tile-0")).toBeDisabled(); // still used
    expect(screen.getByTestId("expression-display")).not.toHaveTextContent("(");
  });

  it("does not show running total by default", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    await userEvent.click(screen.getByTestId("operator-tile-0")); // +
    await userEvent.click(screen.getByTestId("number-tile-1")); // 6
    expect(screen.queryByTestId("expression-result")).not.toBeInTheDocument();
  });

  it("shows running total after clicking Show total", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    await userEvent.click(screen.getByTestId("operator-tile-0")); // +
    await userEvent.click(screen.getByTestId("number-tile-1")); // 6
    await userEvent.click(screen.getByTestId("show-total-btn"));
    expect(screen.getByTestId("expression-result")).toHaveTextContent("= 81");
  });

  it("hides the Show total button once revealed", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("show-total-btn"));
    expect(screen.queryByTestId("show-total-btn")).not.toBeInTheDocument();
  });

  it("backspace removes last token and frees number tile", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    expect(screen.getByTestId("number-tile-0")).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Backspace/ }));
    expect(screen.getByTestId("number-tile-0")).not.toBeDisabled();
    expect(screen.getByTestId("expression-display")).not.toHaveTextContent("75");
  });

  it("clear resets everything", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("number-tile-0"));
    await userEvent.click(screen.getByTestId("operator-tile-0"));
    await userEvent.click(screen.getByTestId("number-tile-1"));

    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.getByTestId("number-tile-0")).not.toBeDisabled();
    expect(screen.getByTestId("number-tile-1")).not.toBeDisabled();
    expect(screen.queryByTestId("expression-result")).not.toBeInTheDocument();
  });
});

describe("CountdownPuzzle submission", () => {
  it("submit is disabled when expression is empty", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    expect(screen.getByTestId("submit-btn")).toBeDisabled();
  });

  it("submit is disabled when expression does not evaluate", async () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={() => {}} onHint={() => {}} loading={false} />);
    await userEvent.click(screen.getByTestId("operator-tile-0")); // just "+" — invalid
    expect(screen.getByTestId("submit-btn")).toBeDisabled();
  });

  it("calls onSubmit with the evaluated result string", async () => {
    const onSubmit = vi.fn();
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={false} onSubmit={onSubmit} loading={false} />);

    await userEvent.click(screen.getByTestId("number-tile-0")); // 75
    await userEvent.click(screen.getByTestId("operator-tile-0")); // +
    await userEvent.click(screen.getByTestId("number-tile-1")); // 6

    await userEvent.click(screen.getByTestId("submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("81");
  });

  it("hides expression area and controls when solved", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={true} onSubmit={() => {}} loading={false} />);
    expect(screen.queryByTestId("expression-display")).not.toBeInTheDocument();
    expect(screen.queryByTestId("submit-btn")).not.toBeInTheDocument();
  });

  it("still shows target and tiles when solved", () => {
    render(<CountdownPuzzle puzzle={makePuzzle(VALID_QUESTION)} solved={true} onSubmit={() => {}} loading={false} />);
    expect(screen.getByTestId("target-number")).toHaveTextContent("81");
    expect(screen.getByTestId("number-tile-0")).toBeInTheDocument();
  });
});
