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
