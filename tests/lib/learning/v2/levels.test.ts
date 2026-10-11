import { describe, expect, it } from "vitest";
import {
  SOLID_CLEAN_ANSWERS,
  addEvidence,
  conceptProgress,
  evidenceFor,
  lastPracticed,
  levelForMove,
  nextStep,
  recognizeState,
  stateOf,
  type ConceptLevels,
  type LevelKey,
  type LevelState,
} from "@/lib/learning/v2/levels";

const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-05T10:00:00.000Z";

describe("levelForMove", () => {
  it("maps each question purpose to the level it shows", () => {
    expect(levelForMove("build")).toBe("explain");
    expect(levelForMove("check")).toBe("apply");
    expect(levelForMove("challenge")).toBe("defend");
  });
});

describe("evidenceFor", () => {
  it("counts a correct first-try answer without help as clean", () => {
    expect(evidenceFor({ verdict: "resolved", attempt: 1, helpUsed: false })).toBe("clean");
  });

  it("counts a correct answer after a hint, or after asking for help, as helped", () => {
    expect(evidenceFor({ verdict: "resolved", attempt: 2, helpUsed: false })).toBe("helped");
    expect(evidenceFor({ verdict: "resolved", attempt: 1, helpUsed: true })).toBe("helped");
  });

  it("gives no credit for partial or unresolved answers", () => {
    for (const verdict of ["partial", "unresolved"] as const) {
      expect(evidenceFor({ verdict, attempt: 1, helpUsed: false })).toBeNull();
      expect(evidenceFor({ verdict, attempt: 2, helpUsed: true })).toBeNull();
    }
  });
});

describe("addEvidence and stateOf", () => {
  it("starts empty, builds with the first correct answer, and is solid at three clean ones", () => {
    expect(SOLID_CLEAN_ANSWERS).toBe(3);
    let levels: ConceptLevels = {};
    expect(stateOf(levels.apply)).toBe("none");

    levels = addEvidence(levels, "apply", "clean", T1);
    expect(stateOf(levels.apply)).toBe("building");
    levels = addEvidence(levels, "apply", "clean", T1);
    expect(stateOf(levels.apply)).toBe("building");
    levels = addEvidence(levels, "apply", "clean", T2);
    expect(stateOf(levels.apply)).toBe("solid");
  });

  it("does not let helped answers make a level solid", () => {
    let levels: ConceptLevels = {};
    for (let i = 0; i < 5; i++) levels = addEvidence(levels, "defend", "helped", T1);
    expect(levels.defend).toMatchObject({ clean: 0, helped: 5 });
    expect(stateOf(levels.defend)).toBe("building");

    levels = addEvidence(levels, "defend", "clean", T1);
    levels = addEvidence(levels, "defend", "clean", T1);
    expect(stateOf(levels.defend)).toBe("building"); // only 2 clean
  });

  it("keeps other levels untouched, records the latest time, and doesn't mutate its input", () => {
    const before: ConceptLevels = { explain: { clean: 1, helped: 0, at: T1 } };
    const after = addEvidence(before, "apply", "clean", T2);
    expect(before).toEqual({ explain: { clean: 1, helped: 0, at: T1 } });
    expect(after.explain).toEqual(before.explain);
    expect(after.apply).toEqual({ clean: 1, helped: 0, at: T2 });
  });
});

describe("recognizeState", () => {
  const ids = ["a", "b", "c"];

  it("is none with no cards or no 'Got it' ratings", () => {
    expect(recognizeState([], {})).toBe("none");
    expect(recognizeState(ids, { a: "forgot", b: "fuzzy" })).toBe("none");
  });

  it("is building once any card is 'Got it', and solid when every card is", () => {
    expect(recognizeState(ids, { a: "got-it" })).toBe("building");
    expect(recognizeState(ids, { a: "got-it", b: "got-it", c: "fuzzy" })).toBe("building");
    expect(recognizeState(ids, { a: "got-it", b: "got-it", c: "got-it" })).toBe("solid");
  });

  it("ignores ratings for cards that no longer exist", () => {
    expect(recognizeState(ids, { gone: "got-it" })).toBe("none");
  });
});

describe("conceptProgress", () => {
  it("combines chat evidence with flashcard ratings", () => {
    const levels: ConceptLevels = {
      explain: { clean: 3, helped: 0, at: T1 },
      apply: { clean: 1, helped: 0, at: T1 },
    };
    expect(conceptProgress(levels, ["a"], { a: "got-it" })).toEqual({
      recognize: "solid",
      explain: "solid",
      apply: "building",
      defend: "none",
    });
  });
});

describe("nextStep", () => {
  const all = (state: LevelState): Record<LevelKey, LevelState> => ({
    recognize: state,
    explain: state,
    apply: state,
    defend: state,
  });

  it("points at the lowest chat level that isn't solid, in order", () => {
    expect(nextStep({ ...all("solid"), explain: "building" })).toMatch(/explain/i);
    expect(nextStep({ ...all("solid"), apply: "none" })).toMatch(/applying/i);
    expect(nextStep({ ...all("solid"), defend: "building" })).toMatch(/what-if/i);
    expect(nextStep({ ...all("none") })).toMatch(/explain/i);
  });

  it("only suggests the flashcards once the chat levels are solid", () => {
    expect(nextStep({ ...all("solid"), recognize: "building" })).toMatch(/flashcards/i);
  });

  it("says so when everything is solid", () => {
    expect(nextStep(all("solid"))).toMatch(/another concept/i);
  });
});

describe("lastPracticed", () => {
  it("is the latest evidence time, or null with none", () => {
    expect(lastPracticed({})).toBeNull();
    expect(
      lastPracticed({
        explain: { clean: 1, helped: 0, at: T1 },
        defend: { clean: 1, helped: 0, at: T2 },
      }),
    ).toBe(T2);
  });
});
