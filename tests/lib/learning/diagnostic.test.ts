import { describe, expect, it } from "vitest";
import { concepts, getConcept } from "@/lib/learning/concepts";
import {
  diagnosticQuestions,
  getQuestionsForConcept,
} from "@/lib/learning/diagnostic";
import {
  getMisconception,
  getMisconceptionsForConcept,
  misconceptions,
} from "@/lib/learning/misconceptions";
import type { DiagnosticQuestion } from "@/lib/learning/types";

const CONCEPT = "gradient-descent";

/** The option in `question` that reveals `misconceptionId`, if any. */
function optionFor(question: DiagnosticQuestion, misconceptionId: string) {
  return question.options.find((o) => o.misconceptionId === misconceptionId);
}

describe("catalog integrity", () => {
  it("has unique ids in each catalog", () => {
    for (const ids of [
      concepts.map((c) => c.id),
      misconceptions.map((m) => m.id),
      diagnosticQuestions.map((q) => q.id),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only references concepts that exist", () => {
    for (const m of misconceptions) expect(getConcept(m.conceptId)).toBeDefined();
    for (const q of diagnosticQuestions) {
      expect(getConcept(q.conceptId)).toBeDefined();
    }
  });

  it("gives every question exactly one correct option and unique option ids", () => {
    for (const q of diagnosticQuestions) {
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });

  it("links wrong options to real misconceptions of the same concept", () => {
    for (const q of diagnosticQuestions) {
      for (const o of q.options) {
        if (o.correct) expect(o.misconceptionId).toBeUndefined();
        if (!o.misconceptionId) continue;
        expect(getMisconception(o.misconceptionId)?.conceptId).toBe(q.conceptId);
      }
    }
  });

  it("does not always put the correct answer in the same position within a concept", () => {
    // Otherwise a learner can guess "always pick the third option" and pass.
    for (const c of concepts) {
      const positions = getQuestionsForConcept(c.id).map((q) =>
        q.options.findIndex((o) => o.correct),
      );
      if (positions.length < 2) continue;
      expect(new Set(positions).size, c.id).toBeGreaterThan(1);
    }
  });

  it("does not let the longest option give the correct answer away", () => {
    // Learners can guess "pick the longest option". Allow the correct option
    // to be the longest in at most half of a concept's questions (so guessing
    // it beats chance only slightly), and never by a glaring margin.
    for (const c of concepts) {
      const questions = getQuestionsForConcept(c.id);
      if (questions.length === 0) continue;

      let longestCount = 0;
      for (const q of questions) {
        const correctLength = q.options.find((o) => o.correct)!.text.length;
        const longestWrong = Math.max(
          ...q.options.filter((o) => !o.correct).map((o) => o.text.length),
        );
        if (correctLength > longestWrong) longestCount++;
        expect(correctLength, `${q.id}: correct answer far longer than the others`)
          .toBeLessThanOrEqual(longestWrong * 1.6);
      }
      expect(longestCount, `${c.id}: correct answer is the longest option too often`)
        .toBeLessThanOrEqual(Math.ceil(questions.length / 2));
    }
  });

  it("gives every concept either both questions and misconceptions or neither", () => {
    // a concept with neither shows "coming soon"; the questions also supply
    // the v2 chat's quick-reply fallback
    // without misconceptions, so a half-finished concept would break the flow.
    for (const c of concepts) {
      expect(
        getQuestionsForConcept(c.id).length > 0,
        c.id,
      ).toBe(getMisconceptionsForConcept(c.id).length > 0);
    }
  });

  it("has a question that can reveal each misconception", () => {
    for (const m of misconceptions) {
      expect(
        diagnosticQuestions.some((q) => optionFor(q, m.id)),
        m.id,
      ).toBe(true);
    }
  });
});

describe("lookups", () => {
  it("returns undefined for unknown ids", () => {
    expect(getConcept("nope")).toBeUndefined();
    expect(getMisconception("nope")).toBeUndefined();
  });

  it("filters by concept", () => {
    expect(getQuestionsForConcept("nope")).toEqual([]);
    expect(getMisconceptionsForConcept(CONCEPT).length).toBeGreaterThan(0);
  });
});

describe("hand-written catalog examples", () => {
  const withExample = misconceptions.filter((m) => m.example);

  it("gives every misconception an example, since a missing one falls back to the model", () => {
    expect(withExample).toHaveLength(misconceptions.length);
  });

  it("keeps each one short enough to read in a chat bubble", () => {
    for (const m of withExample) {
      expect(m.example!.length, m.id).toBeGreaterThan(80);
      expect(m.example!.length, m.id).toBeLessThan(500);
    }
  });

  it("writes them as plain prose a learner can read", () => {
    for (const m of withExample) {
      // No markdown, LaTeX or internal ids leaking into learner-facing text.
      // A lone * is fine: the examples use it for multiplication.
      expect(m.example!, m.id).not.toMatch(/\*\*|__|`|^#|\\[a-zA-Z]+|\$\$/);
      expect(m.example!, m.id).not.toContain(m.id);
      expect(m.example!.trim(), m.id).toBe(m.example);
    }
  });

  it("makes each one concrete rather than restating the correction", () => {
    for (const m of withExample) {
      // An example earns its place by being specific: numbers or a scenario.
      expect(/\d/.test(m.example!), `${m.id} has no numbers`).toBe(true);
      expect(m.example!, m.id).not.toBe(m.correction);
    }
  });
});
