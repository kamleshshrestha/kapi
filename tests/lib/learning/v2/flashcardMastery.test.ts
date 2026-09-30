import { describe, expect, it } from "vitest";
import { readMastery, writeMastery } from "@/lib/learning/v2/flashcardMastery";

// Vitest's "node" environment has no `window`, matching the first server
// render of a "use client" component — these helpers must degrade quietly.
describe("flashcardMastery without window", () => {
  it("readMastery returns an empty map instead of throwing", () => {
    expect(readMastery("gradient-descent")).toEqual({});
  });

  it("writeMastery returns the updated map without touching storage", () => {
    const result = writeMastery("gradient-descent", "gd-one-step", "got-it");
    expect(result).toEqual({ "gd-one-step": "got-it" });
  });
});
