import type { MasteryMap } from "./flashcardMastery";

/**
 * Depth of understanding, per concept. Four independent levels (not a strict
 * ladder: a learner can show Defend without having rated flashcards):
 * - recognize: spots the false statements; from the concept's Core flashcards
 *   (self-rated, so the weakest evidence)
 * - explain:   says it in their own words; a strong first explanation, or a
 *   correct answer to a "build" question
 * - apply:     uses it in a plain scenario; a correct "check" answer
 * - defend:    handles an edge case or counter-example; a correct "challenge" answer
 *
 * The evidence comes from what the chat already records per answer (the
 * question's move, the verdict and whether a hint was needed), so no extra
 * model call is involved. Levels only go up: they are the best shown so far.
 */
export type LevelKey = "recognize" | "explain" | "apply" | "defend";
/** The levels backed by answers in the chat; recognize comes from flashcards. */
export type EvidenceLevel = Exclude<LevelKey, "recognize">;
export type LevelState = "none" | "building" | "solid";
/** "clean": right on the first try, unaided. "helped": right after a hint. */
export type EvidenceKind = "clean" | "helped";
export type Move = "build" | "check" | "challenge";

/** Clean answers needed before a level counts as solid. */
export const SOLID_CLEAN_ANSWERS = 3;

export const LEVELS: { key: LevelKey; label: string; description: string }[] = [
  { key: "recognize", label: "Recognize", description: "You can spot the false statements (from your flashcards)." },
  { key: "explain", label: "Explain", description: "You can explain it in your own words." },
  { key: "apply", label: "Apply", description: "You can use it on a concrete example." },
  { key: "defend", label: "Defend", description: "You can handle a tough what-if." },
];

export type LevelProgress = {
  clean: number;
  helped: number;
  /** When evidence was last added (ISO). */
  at: string;
};
export type ConceptLevels = Partial<Record<EvidenceLevel, LevelProgress>>;

const LEVEL_FOR_MOVE: Record<Move, EvidenceLevel> = {
  build: "explain",
  check: "apply",
  challenge: "defend",
};

export function levelForMove(move: Move): EvidenceLevel {
  return LEVEL_FOR_MOVE[move];
}

/**
 * What one finished answer is worth. Only a correct answer counts: partial
 * and unresolved ones show nothing yet. A hint (asked for, or given after a
 * first miss) makes it "helped" rather than "clean".
 */
export function evidenceFor({
  verdict,
  attempt,
  helpUsed,
}: {
  verdict: "resolved" | "partial" | "unresolved";
  attempt: number;
  helpUsed: boolean;
}): EvidenceKind | null {
  if (verdict !== "resolved") return null;
  return attempt === 1 && !helpUsed ? "clean" : "helped";
}

export function addEvidence(
  levels: ConceptLevels,
  level: EvidenceLevel,
  kind: EvidenceKind,
  at: string,
): ConceptLevels {
  const current = levels[level] ?? { clean: 0, helped: 0, at };
  return {
    ...levels,
    [level]: {
      clean: current.clean + (kind === "clean" ? 1 : 0),
      helped: current.helped + (kind === "helped" ? 1 : 0),
      at,
    },
  };
}

export function stateOf(progress: LevelProgress | undefined): LevelState {
  if (!progress) return "none";
  if (progress.clean >= SOLID_CLEAN_ANSWERS) return "solid";
  return progress.clean + progress.helped > 0 ? "building" : "none";
}

/**
 * Recognize from the concept's Core flashcards: solid once every card is
 * rated "Got it", building once any is.
 */
export function recognizeState(cardIds: string[], mastery: MasteryMap): LevelState {
  if (cardIds.length === 0) return "none";
  const gotIt = cardIds.filter((id) => mastery[id] === "got-it").length;
  if (gotIt === cardIds.length) return "solid";
  return gotIt > 0 ? "building" : "none";
}

export function conceptProgress(
  levels: ConceptLevels,
  cardIds: string[],
  mastery: MasteryMap,
): Record<LevelKey, LevelState> {
  return {
    recognize: recognizeState(cardIds, mastery),
    explain: stateOf(levels.explain),
    apply: stateOf(levels.apply),
    defend: stateOf(levels.defend),
  };
}

/** A rule-based suggestion for what to do next, from the lowest level not yet solid. */
export function nextStep(states: Record<LevelKey, LevelState>): string {
  if (states.explain !== "solid") {
    return "Next: explain the idea in your own words in another session.";
  }
  if (states.apply !== "solid") {
    return "Next: practice applying it to a concrete example.";
  }
  if (states.defend !== "solid") {
    return "Next: take on a tougher what-if question.";
  }
  if (states.recognize !== "solid") {
    return "Next: review your flashcards until you can spot every false statement.";
  }
  return "You've covered every level here. Try another concept.";
}

/** When any level last got evidence (ISO), or null if none has. */
export function lastPracticed(levels: ConceptLevels): string | null {
  const times = Object.values(levels)
    .map((p) => p?.at)
    .filter((at): at is string => !!at);
  return times.length > 0 ? times.reduce((a, b) => (a > b ? a : b)) : null;
}
