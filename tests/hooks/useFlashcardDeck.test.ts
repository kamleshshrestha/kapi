// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useFlashcardDeck } from "@/hooks/useFlashcardDeck";
import type { Flashcard } from "@/lib/learning/v2/flashcards";
import { readMastery, writeMastery } from "@/lib/learning/v2/flashcardMastery";

const CARDS: Flashcard[] = [
  { id: "a", front: "Front A", back: "Back A" },
  { id: "b", front: "Front B", back: "Back B" },
  { id: "c", front: "Front C", back: "Back C" },
];

function setup(cards = CARDS) {
  // Stable reference: the hook restarts from the `cards` it was given.
  return renderHook(() => useFlashcardDeck("overfitting", cards));
}

beforeEach(() => window.localStorage.clear());

describe("useFlashcardDeck", () => {
  it("starts on the first card, face up, with nothing done", () => {
    const { result } = setup();

    expect(result.current.card).toEqual(CARDS[0]);
    expect(result.current.index).toBe(0);
    expect(result.current.total).toBe(3);
    expect(result.current.flipped).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it("loads saved ratings from localStorage", async () => {
    writeMastery("overfitting", "a", "got-it");

    const { result } = setup();

    await waitFor(() => expect(result.current.mastery).toEqual({ a: "got-it" }));
  });

  it("flip toggles the card", () => {
    const { result } = setup();

    act(() => result.current.flip());
    expect(result.current.flipped).toBe(true);
    act(() => result.current.flip());
    expect(result.current.flipped).toBe(false);
  });

  it("rate stores the rating, advances, and turns the next card face up", () => {
    const { result } = setup();
    act(() => result.current.flip());

    act(() => result.current.rate("fuzzy"));

    expect(result.current.card).toEqual(CARDS[1]);
    expect(result.current.index).toBe(1);
    expect(result.current.flipped).toBe(false);
    expect(result.current.mastery).toEqual({ a: "fuzzy" });
    expect(readMastery("overfitting")).toEqual({ a: "fuzzy" });
  });

  it("is done after rating every card, with no current card", () => {
    const { result } = setup();

    act(() => result.current.rate("got-it"));
    act(() => result.current.rate("got-it"));
    act(() => result.current.rate("got-it"));

    expect(result.current.done).toBe(true);
    expect(result.current.card).toBeUndefined();
  });

  it("rate does nothing once the deck is done", () => {
    const { result } = setup();
    for (let i = 0; i < 3; i++) act(() => result.current.rate("got-it"));

    act(() => result.current.rate("forgot"));

    expect(result.current.index).toBe(3);
    expect(readMastery("overfitting")).toEqual({ a: "got-it", b: "got-it", c: "got-it" });
  });

  it("reviewMissed requeues only forgot and fuzzy cards, in order", () => {
    const { result } = setup();
    act(() => result.current.rate("forgot"));
    act(() => result.current.rate("got-it"));
    act(() => result.current.rate("fuzzy"));

    act(() => result.current.reviewMissed());

    expect(result.current.total).toBe(2);
    expect(result.current.card).toEqual(CARDS[0]);
    expect(result.current.index).toBe(0);
    expect(result.current.done).toBe(false);
  });

  it("reviewMissed with nothing missed leaves an empty, finished deck", () => {
    const { result } = setup();
    for (let i = 0; i < 3; i++) act(() => result.current.rate("got-it"));

    act(() => result.current.reviewMissed());

    expect(result.current.total).toBe(0);
    expect(result.current.done).toBe(true);
  });

  it("a card re-rated as got-it drops out of the next missed pass", () => {
    const { result } = setup();
    act(() => result.current.rate("forgot"));
    act(() => result.current.rate("forgot"));
    act(() => result.current.rate("got-it"));
    act(() => result.current.reviewMissed());
    act(() => result.current.rate("got-it"));
    act(() => result.current.rate("forgot"));

    act(() => result.current.reviewMissed());

    expect(result.current.total).toBe(1);
    expect(result.current.card).toEqual(CARDS[1]);
  });

  it("restart returns to the full deck from the top", () => {
    const { result } = setup();
    act(() => result.current.rate("forgot"));
    act(() => result.current.rate("got-it"));
    act(() => result.current.rate("got-it"));
    act(() => result.current.reviewMissed());

    act(() => result.current.restart());

    expect(result.current.total).toBe(3);
    expect(result.current.index).toBe(0);
    expect(result.current.card).toEqual(CARDS[0]);
    expect(result.current.flipped).toBe(false);
  });
});
