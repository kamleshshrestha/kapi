import { describe, expect, it } from "vitest";
import { readPersonalCards, savePersonalCard } from "@/lib/learning/v2/personalCards";

// Vitest's "node" environment has no `window`, matching the first server
// render of a "use client" component — these helpers must degrade quietly.
describe("personalCards without window", () => {
  it("readPersonalCards returns an empty array instead of throwing", () => {
    expect(readPersonalCards("gradient-descent")).toEqual([]);
  });

  it("savePersonalCard returns the new card without touching storage", () => {
    const result = savePersonalCard("gradient-descent", {
      misconceptionId: "gd-one-step",
      front: "If we take one step downhill, are we at the bottom?",
      back: "No — you explained it takes many repeated steps.",
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "personal:gd-one-step",
        misconceptionId: "gd-one-step",
      }),
    ]);
  });
});
