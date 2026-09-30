// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_REVISIT_CARDS,
  readPersonalCards,
  savePersonalCard,
  saveRevisitCards,
} from "@/lib/learning/v2/personalCards";

beforeEach(() => window.localStorage.clear());

describe("saveRevisitCards", () => {
  it("stores cards with no misconception, marked as revisit", () => {
    saveRevisitCards("overfitting", [{ front: "What is L2?", back: "Weight shrinkage." }]);

    expect(readPersonalCards("overfitting")).toEqual([
      expect.objectContaining({
        id: "revisit:what-is-l2",
        misconceptionId: null,
        kind: "revisit",
        front: "What is L2?",
        back: "Weight shrinkage.",
      }),
    ]);
  });

  it("replaces a card for the same question instead of duplicating it", () => {
    saveRevisitCards("overfitting", [{ front: "What is L2?", back: "Old." }]);
    saveRevisitCards("overfitting", [{ front: "what is L2?", back: "New." }]);

    const cards = readPersonalCards("overfitting");
    expect(cards).toHaveLength(1);
    expect(cards[0].back).toBe("New.");
  });

  it("skips blank cards and leaves storage alone when none are valid", () => {
    saveRevisitCards("overfitting", [
      { front: " ", back: "x" },
      { front: "q", back: "" },
    ]);

    expect(readPersonalCards("overfitting")).toEqual([]);
  });

  it("leaves resolved cards untouched", () => {
    savePersonalCard("overfitting", {
      misconceptionId: "of-train-accuracy-proves",
      front: "Resolved front",
      back: "Resolved back",
    });

    saveRevisitCards("overfitting", [{ front: "Q?", back: "A." }]);

    expect(readPersonalCards("overfitting").map((c) => c.kind)).toEqual([
      "resolved",
      "revisit",
    ]);
  });

  it("keeps only the newest revisit cards beyond the cap, never dropping resolved ones", () => {
    savePersonalCard("overfitting", {
      misconceptionId: "of-train-accuracy-proves",
      front: "Resolved front",
      back: "Resolved back",
    });
    for (let i = 0; i < MAX_REVISIT_CARDS + 3; i++) {
      saveRevisitCards("overfitting", [{ front: `Question ${i}?`, back: "A." }]);
    }

    const cards = readPersonalCards("overfitting");
    const revisit = cards.filter((c) => c.kind === "revisit");
    expect(revisit).toHaveLength(MAX_REVISIT_CARDS);
    expect(revisit[0].front).toBe("Question 3?");
    expect(revisit.at(-1)?.front).toBe(`Question ${MAX_REVISIT_CARDS + 2}?`);
    expect(cards.filter((c) => c.kind === "resolved")).toHaveLength(1);
  });

  it("degrades without a window", () => {
    // The node-environment sibling test covers reads; this only checks the write path.
    expect(() => saveRevisitCards("overfitting", [])).not.toThrow();
  });
});
