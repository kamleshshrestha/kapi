// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import FlashcardDeck from "@/components/v2/FlashcardDeck";
import type { Flashcard } from "@/lib/learning/v2/flashcards";
import { savePersonalCard } from "@/lib/learning/v2/personalCards";

const CORE: Flashcard[] = [
  { id: "a", front: "Front A", back: "Back A" },
  { id: "b", front: "Front B", back: "Back B" },
];

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function renderDeck(coreCards = CORE) {
  render(
    <FlashcardDeck
      conceptId="overfitting"
      conceptTitle="Overfitting"
      coreCards={coreCards}
    />,
  );
}

/** Flip the current card, then rate it. */
function review(rating: "Forgot" | "Fuzzy" | "Got it") {
  fireEvent.click(screen.getByRole("button", { name: /tap to flip/ }));
  fireEvent.click(screen.getByRole("button", { name: rating }));
}

describe("FlashcardDeck", () => {
  it("shows the first card's front and progress, with no rating buttons yet", () => {
    renderDeck();

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Front A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  it("flips to the back and offers the three ratings", () => {
    renderDeck();

    fireEvent.click(screen.getByRole("button", { name: /tap to flip/ }));

    expect(screen.getByText("Back A")).toBeInTheDocument();
    for (const name of ["Forgot", "Fuzzy", "Got it"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("advances to the next card after rating", () => {
    renderDeck();

    review("Got it");

    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Front B")).toBeInTheDocument();
  });

  it("summarises the run and offers to review only the missed cards", () => {
    renderDeck();
    review("Forgot");
    review("Got it");

    expect(screen.getByText("Deck complete")).toBeInTheDocument();
    expect(screen.getByText(/1 got it, 0 fuzzy, 1 forgot — out of 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review missed (1)" }));

    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Front A")).toBeInTheDocument();
  });

  it("hides 'Review missed' when every card was got, and can restart", () => {
    renderDeck();
    review("Got it");
    review("Got it");

    expect(screen.queryByRole("button", { name: /Review missed/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Review again" }));
    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
  });

  it("links back to the concept list from the completion screen", () => {
    renderDeck();
    review("Got it");
    review("Got it");

    expect(screen.getByRole("link", { name: "Back to concepts" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows an empty state for the personalised deck until a card is saved", () => {
    renderDeck();

    fireEvent.click(screen.getByRole("button", { name: "From you (0)" }));

    expect(screen.getByText(/No personalized cards yet/)).toBeInTheDocument();
  });

  it("lists saved personal cards in the 'From you' deck", async () => {
    savePersonalCard("overfitting", {
      misconceptionId: "of-train-accuracy-proves",
      front: "Personal front",
      back: "Personal back",
    });
    renderDeck();

    fireEvent.click(await screen.findByRole("button", { name: "From you (1)" }));

    expect(screen.getByText("Personal front")).toBeInTheDocument();
  });

  it("shows an empty state when the concept has no core cards", () => {
    renderDeck([]);
    expect(screen.getByText("No flashcards for Overfitting yet.")).toBeInTheDocument();
  });
});
