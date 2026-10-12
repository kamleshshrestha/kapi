import { describe, expect, it } from "vitest";
import { evalCases } from "@/evals/cases";
import { concepts } from "@/lib/learning/concepts";
import { getMisconception, getMisconceptionsForConcept } from "@/lib/learning/misconceptions";

describe("evaluation cases", () => {
  it("have unique, consecutive ids", () => {
    expect(evalCases.map((c) => c.id)).toEqual(evalCases.map((_, i) => i + 1));
  });

  it("cover every concept that can be diagnosed with two gaps, one strong and one tricky case", () => {
    const diagnosable = concepts.filter((c) => getMisconceptionsForConcept(c.id).length > 0);
    for (const { id } of diagnosable) {
      const kinds = evalCases.filter((c) => c.conceptId === id).map((c) => c.kind).sort();
      expect(kinds, id).toEqual(["gap", "gap", "strong", "tricky"]);
    }
    expect(evalCases.every((c) => diagnosable.some((d) => d.id === c.conceptId))).toBe(true);
  });

  it("only accept misconceptions of the case's own concept", () => {
    for (const c of evalCases) {
      for (const id of c.acceptable) {
        expect(getMisconception(id)?.conceptId, `case ${c.id}: ${id}`).toBe(c.conceptId);
      }
    }
  });

  it("expect no gap exactly for strong explanations", () => {
    for (const c of evalCases) {
      expect(c.acceptable.length === 0, `case ${c.id}`).toBe(c.kind === "strong");
    }
  });

  it("give every gap case a different primary misconception within its concept", () => {
    const gaps = evalCases.filter((c) => c.kind === "gap");
    const keys = gaps.map((c) => `${c.conceptId}:${c.acceptable[0]}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("have non-trivial explanations", () => {
    for (const c of evalCases) expect(c.explanation.length, `case ${c.id}`).toBeGreaterThan(60);
  });
});
