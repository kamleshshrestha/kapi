import { describe, expect, it } from "vitest";
import { teachCases } from "@/evals/teachCases";
import { concepts } from "@/lib/learning/concepts";
import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";

describe("teach-it-back evaluation cases", () => {
  it("have unique, consecutive ids", () => {
    expect(teachCases.map((c) => c.id)).toEqual(teachCases.map((_, i) => i + 1));
  });

  it("cover every diagnosable concept twice, with four solid, four partial and four shaky labels", () => {
    const diagnosable = concepts.filter((c) => getMisconceptionsForConcept(c.id).length > 0);
    for (const { id } of diagnosable) {
      expect(teachCases.filter((c) => c.conceptId === id).length, id).toBe(2);
    }
    expect(teachCases.every((c) => diagnosable.some((d) => d.id === c.conceptId))).toBe(true);
    for (const verdict of ["solid", "partial", "shaky"]) {
      expect(teachCases.filter((c) => c.expected === verdict).length, verdict).toBe(4);
    }
  });

  it("have non-trivial learner messages and one beginner question per gap between them", () => {
    for (const c of teachCases) {
      expect(c.learner.length).toBe(3);
      expect(c.beginner.length).toBe(2);
      for (const m of c.learner) expect(m.length, `case ${c.id}`).toBeGreaterThan(60);
      for (const q of c.beginner) expect(q.match(/\?/g)?.length, `case ${c.id}`).toBe(1);
    }
  });
});
