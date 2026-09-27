import { describe, expect, it } from "vitest";
import { pickOpener, welcomeBackOpener } from "@/lib/learning/v2/openers";

describe("pickOpener", () => {
  it("always includes the concept title", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickOpener("Gradient descent")).toContain("Gradient descent");
    }
  });

  it("can return more than one variant", () => {
    const seen = new Set(Array.from({ length: 30 }, () => pickOpener("Overfitting")));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("welcomeBackOpener", () => {
  it("acknowledges a resolved misconception", () => {
    const text = welcomeBackOpener("Overfitting", {
      misconceptionTitle: "Thinks more complexity is always better",
      resolved: true,
    });
    expect(text).toContain("Overfitting");
    expect(text).toContain("Thinks more complexity is always better");
  });

  it("offers to pick back up an unresolved misconception", () => {
    const text = welcomeBackOpener("Overfitting", {
      misconceptionTitle: "Thinks more complexity is always better",
      resolved: false,
    });
    expect(text).toContain("pick that back up");
  });
});
