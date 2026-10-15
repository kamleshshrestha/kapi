import { describe, expect, it } from "vitest";

import {
  SAMPLE_EXCHANGE,
  SAMPLE_EXCHANGE_HEADING,
} from "@/lib/learning/v2/sampleExchange";
import { concepts } from "@/lib/learning/concepts";

describe("SAMPLE_EXCHANGE", () => {
  it("is a short exchange that Kapi opens and closes", () => {
    expect(SAMPLE_EXCHANGE).toHaveLength(3);
    expect(SAMPLE_EXCHANGE.map((m) => m.role)).toEqual(["kapi", "learner", "kapi"]);
  });

  it("shows the learner saying something rough, which is the point", () => {
    const learner = SAMPLE_EXCHANGE.find((m) => m.role === "learner")!;
    // Long enough to read as a real attempt, short enough not to look daunting.
    expect(learner.text.length).toBeGreaterThan(40);
    expect(learner.text.length).toBeLessThan(220);
  });

  it("ends on a question, so the example shows Kapi asking rather than lecturing", () => {
    expect(SAMPLE_EXCHANGE.at(-1)!.text.trim().endsWith("?")).toBe(true);
  });

  it("stays short enough not to push the concept list off the page", () => {
    const total = SAMPLE_EXCHANGE.reduce((n, m) => n + m.text.length, 0);
    expect(total).toBeLessThan(600);
  });

  it("uses a concept the learner can actually pick afterwards", () => {
    const titles = concepts.map((c) => c.title.toLowerCase());
    const opener = SAMPLE_EXCHANGE[0].text.toLowerCase();
    expect(titles.some((t) => opener.includes(t))).toBe(true);
  });

  it("is labelled as an example rather than passing for a live chat", () => {
    expect(SAMPLE_EXCHANGE_HEADING.length).toBeGreaterThan(0);
  });
});
