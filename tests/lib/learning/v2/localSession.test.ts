import { describe, expect, it } from "vitest";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";

// Vitest's "node" environment has no `window`, matching the first server
// render of a "use client" component — these helpers must degrade quietly.
describe("localSession without window", () => {
  it("readLastSession returns null instead of throwing", () => {
    expect(readLastSession("gradient-descent")).toBeNull();
  });

  it("writeLastSession is a no-op instead of throwing", () => {
    expect(() =>
      writeLastSession("gradient-descent", {
        misconceptionId: "gd-one-step",
        misconceptionTitle: "Thinks it jumps straight to the minimum",
        resolved: true,
        at: new Date().toISOString(),
      }),
    ).not.toThrow();
  });
});
