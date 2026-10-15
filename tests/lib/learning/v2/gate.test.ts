import { describe, expect, it } from "vitest";

import { GATE_ACTIONS, GATE_ASK_PROMPT, pickGateLine } from "@/lib/learning/v2/gate";

describe("pickGateLine", () => {
  it("asks something, every time", () => {
    for (let i = 0; i < 50; i++) {
      const line = pickGateLine();
      expect(line.trim()).toBe(line);
      expect(line.length).toBeGreaterThan(10);
      // It is a check-in, so it has to read as a question the learner answers.
      expect(line.endsWith("?")).toBe(true);
    }
  });

  it("varies, so a learner doing several concepts does not read the same line", () => {
    const seen = new Set(Array.from({ length: 80 }, pickGateLine));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("GATE_ACTIONS", () => {
  it("offers going on and asking first, in that order", () => {
    expect(GATE_ACTIONS.map((a) => a.kind)).toEqual(["ready", "ask"]);
    for (const { label } of GATE_ACTIONS) expect(label.length).toBeGreaterThan(0);
  });

  it("invites the question once the learner picks asking", () => {
    expect(GATE_ASK_PROMPT.length).toBeGreaterThan(10);
  });
});
