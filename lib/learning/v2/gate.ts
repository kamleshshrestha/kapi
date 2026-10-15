/**
 * The checkpoint between Kapi's explanation of a learner's gap and the example
 * and question that follow it. A learner told us the opening arrived as one
 * long text and that they wanted to be asked whether they still had questions
 * before being quizzed on an example, so the explanation now stops here and
 * waits.
 *
 * All of this is static copy picked in the browser: no LLM call, so the
 * checkpoint costs nothing and appears instantly. Draft copy: reword freely.
 */
const GATE_TEMPLATES: string[] = [
  "Before I show you an example — does that land, or do you have a question about it?",
  "Does that make sense so far, or is something still off?",
  "Is that clear enough to build on, or shall I go over part of it again?",
];

export function pickGateLine(): string {
  return GATE_TEMPLATES[Math.floor(Math.random() * GATE_TEMPLATES.length)];
}

/** What the learner can say at the checkpoint. */
export const GATE_ACTIONS = [
  { kind: "ready", label: "Makes sense" },
  { kind: "ask", label: "I have a question" },
] as const;

export type GateKind = (typeof GATE_ACTIONS)[number]["kind"];

/** Shown once the learner picks "I have a question", so the input has a purpose. */
export const GATE_ASK_PROMPT = "Go ahead — what's still unclear?";
