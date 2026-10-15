export type Concept = {
  id: string;
  title: string;
  summary: string;
};

/** A specific, named wrong belief a learner can hold about a concept. */
export type Misconception = {
  id: string;
  conceptId: string;
  title: string;
  /** What the learner believes, phrased from their point of view. */
  belief: string;
  /** What is actually true. */
  correction: string;
  /**
   * A hand-written, hand-checked example that makes the correction concrete.
   * Shown to the learner as written, instead of one the model invents: both
   * real inaccuracies the evaluation found were in generated examples, where a
   * beginner cannot catch a slip and every number looked plausible. Keep the
   * arithmetic checkable and the claim exactly what the numbers show.
   */
  example?: string;
};

export type DiagnosticOption = {
  id: string;
  text: string;
  correct: boolean;
  /** Set on wrong options that reveal a specific misconception. */
  misconceptionId?: string;
};

export type DiagnosticQuestion = {
  id: string;
  conceptId: string;
  prompt: string;
  options: DiagnosticOption[];
};
