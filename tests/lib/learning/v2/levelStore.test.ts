// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readConceptProgress, readLevels, recordEvidence } from "@/lib/learning/v2/levelStore";
import { getCoreCards } from "@/lib/learning/v2/flashcards";
import { writeMastery } from "@/lib/learning/v2/flashcardMastery";

beforeEach(() => window.localStorage.clear());

describe("levelStore", () => {
  it("records evidence per concept and reads it back", () => {
    recordEvidence("overfitting", "apply", "clean");
    const after = recordEvidence("overfitting", "apply", "helped");
    expect(after.apply).toMatchObject({ clean: 1, helped: 1 });
    expect(readLevels("overfitting").apply).toMatchObject({ clean: 1, helped: 1 });
    expect(readLevels("gradient-descent")).toEqual({});
  });

  it("ignores damaged or unexpected stored values instead of breaking", () => {
    window.localStorage.setItem("kapi:v2:levels:overfitting", "{not json");
    expect(readLevels("overfitting")).toEqual({});

    window.localStorage.setItem(
      "kapi:v2:levels:overfitting",
      JSON.stringify({
        explain: { clean: -4, helped: "x", at: "2026-10-01T00:00:00.000Z" },
        apply: { clean: 2.9, helped: 1, at: 123 },
        recognize: { clean: 9, helped: 9, at: "2026-10-01T00:00:00.000Z" },
        defend: { clean: 2, helped: 0, at: "2026-10-02T00:00:00.000Z" },
      }),
    );
    expect(readLevels("overfitting")).toEqual({
      explain: { clean: 0, helped: 0, at: "2026-10-01T00:00:00.000Z" }, // bad numbers become 0
      defend: { clean: 2, helped: 0, at: "2026-10-02T00:00:00.000Z" }, // missing time dropped; unknown level dropped
    });
  });

  it("reads the four states from chat evidence and Core flashcard ratings", () => {
    expect(readConceptProgress("overfitting")).toEqual({
      recognize: "none",
      explain: "none",
      apply: "none",
      defend: "none",
    });

    for (let i = 0; i < 3; i++) recordEvidence("overfitting", "defend", "clean");
    recordEvidence("overfitting", "explain", "helped");
    const cards = getCoreCards("overfitting");
    expect(cards.length).toBeGreaterThan(1);
    writeMastery("overfitting", cards[0].id, "got-it");

    expect(readConceptProgress("overfitting")).toEqual({
      recognize: "building",
      explain: "building",
      apply: "none",
      defend: "solid",
    });
  });
});
