// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const DECK = "/decks/overfitting";

import SessionSummary from "@/components/v2/SessionSummary";

afterEach(cleanup);

describe("SessionSummary", () => {
  it("renders each non-empty section with its items", () => {
    render(
      <SessionSummary
        summary={{
          understood: ["Test score matters."],
          fixed: ["High train score is not proof.", "Gaps can be noise."],
          revisit: [
            {
              idea: "Regularisation.",
              question: "What does L2 do?",
              answer: "It shrinks weights.",
            },
          ],
        }}
        deckHref={DECK}
      />,
    );

    expect(screen.getByRole("heading", { name: "What you've got" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What you fixed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Worth revisiting" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("leaves out empty sections", () => {
    render(
      <SessionSummary
        summary={{ understood: ["Test score matters."], fixed: [], revisit: [] }}
        deckHref={DECK}
      />,
    );

    expect(screen.queryByRole("heading", { name: "What you fixed" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Worth revisiting" })).toBeNull();
  });

  it("renders nothing when every list is empty", () => {
    const { container } = render(
      <SessionSummary summary={{ understood: [], fixed: [], revisit: [] }} deckHref={DECK} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each revisit idea by its one-line description", () => {
    render(
      <SessionSummary
        summary={{
          understood: [],
          fixed: [],
          revisit: [{ idea: "Regularisation.", question: "Q?", answer: "A." }],
        }}
        deckHref={DECK}
      />,
    );

    expect(screen.getByText("Regularisation.")).toBeInTheDocument();
    expect(screen.queryByText("Q?")).toBeNull();
  });

  it("links to the deck and counts the cards that were added", () => {
    const summary = {
      understood: [],
      fixed: [],
      revisit: [{ idea: "x", question: "Q?", answer: "A." }],
    };
    const { rerender } = render(
      <SessionSummary summary={summary} savedCards={1} deckHref={DECK} />,
    );

    expect(screen.getByText(/Added 1 card to your flashcards/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review them" })).toHaveAttribute("href", DECK);

    rerender(<SessionSummary summary={summary} savedCards={3} deckHref={DECK} />);
    expect(screen.getByText(/Added 3 cards to your flashcards/)).toBeInTheDocument();
  });

  it("omits the flashcard note when nothing was added", () => {
    render(
      <SessionSummary
        summary={{ understood: ["x"], fixed: [], revisit: [] }}
        savedCards={0}
        deckHref={DECK}
      />,
    );

    expect(screen.queryByRole("link", { name: "Review them" })).toBeNull();
  });
});
