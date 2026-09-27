import { describe, expect, it } from "vitest";
import { getCoreCards } from "@/lib/learning/v2/flashcards";
import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";
import { concepts } from "@/lib/learning/concepts";

describe("getCoreCards", () => {
  it("returns one card per misconception, in the same order", () => {
    for (const concept of concepts) {
      const misconceptions = getMisconceptionsForConcept(concept.id);
      const cards = getCoreCards(concept.id);
      expect(cards.map((c) => c.id)).toEqual(misconceptions.map((m) => m.id));
    }
  });

  it("puts the belief on the front as a true/false prompt", () => {
    const [card] = getCoreCards("gradient-descent");
    const [misconception] = getMisconceptionsForConcept("gradient-descent");
    expect(card.front).toBe(`True or false: ${misconception.belief}`);
  });

  it("puts the correction on the back, marked false", () => {
    const [card] = getCoreCards("gradient-descent");
    const [misconception] = getMisconceptionsForConcept("gradient-descent");
    expect(card.back).toBe(`False. ${misconception.correction}`);
  });

  it("returns an empty array for an unknown concept", () => {
    expect(getCoreCards("not-a-real-concept")).toEqual([]);
  });
});
