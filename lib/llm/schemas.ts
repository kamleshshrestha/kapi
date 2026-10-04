import { z } from "zod";

// --- Request bodies (validated in the route handlers) -----------------------

const id = z.string().min(1).max(100);
const freeText = z.string().trim().min(1).max(2000);

// --- v2 chat session ---------------------------------------------------

export const chatDiagnoseRequestSchema = z.object({
  conceptId: id,
  phase: z.literal("diagnose"),
  explanation: freeText,
});

const chatHistoryMessageSchema = z.object({
  role: z.enum(["kapi", "learner"]),
  text: z.string().max(3000),
});

/**
 * What a question is for. "build": the learner is missing or shaky on an idea,
 * so Kapi teaches a small piece and asks an easy guiding question. "check":
 * confirm the basics by applying them in a plain scenario. "challenge":
 * analytical or edge-case questions, only once the basics are shown.
 */
export const chatMoves = ["build", "check", "challenge"] as const;
export type ChatMove = (typeof chatMoves)[number];

const chatVerdictSchema = z.enum(["resolved", "partial", "unresolved"]);

export const chatCheckRequestSchema = z.object({
  conceptId: id,
  phase: z.literal("check"),
  /** null when the learner's explanation was strong and Kapi is challenging it. */
  misconceptionId: id.nullable(),
  probeQuestion: z.string().trim().min(1).max(1000),
  answer: freeText,
  /** The conversation so far, before this answer, so follow-ups build on it. */
  history: z.array(chatHistoryMessageSchema).max(30),
  /** 1-based number of the question being answered. */
  turn: z.number().int().min(1).max(20),
  /** 1 on the first try at this question; 2 once a hint has been given. */
  attempt: z.number().int().min(1).max(2).default(1),
  /** What the question being answered was for. */
  move: z.enum(chatMoves).default("build"),
  /** Verdict on each earlier answer, in order, so Kapi can read the learner's progress. */
  verdicts: z.array(chatVerdictSchema).max(20).default([]),
});

/** The learner asking for help instead of answering. */
export const chatAssistKinds = ["hint", "lost", "rephrase"] as const;

export const chatAssistRequestSchema = z.object({
  conceptId: id,
  phase: z.literal("assist"),
  kind: z.enum(chatAssistKinds),
  misconceptionId: id.nullable(),
  probeQuestion: z.string().trim().min(1).max(1000),
  history: z.array(chatHistoryMessageSchema).max(30),
});

export const chatSummaryRequestSchema = z.object({
  conceptId: id,
  phase: z.literal("summary"),
  misconceptionId: id.nullable(),
  history: z.array(chatHistoryMessageSchema).max(30),
  /** Verdict on each answer the learner gave, in order. */
  verdicts: z.array(chatVerdictSchema).max(20),
});

export const chatTurnRequestSchema = z.discriminatedUnion("phase", [
  chatDiagnoseRequestSchema,
  chatCheckRequestSchema,
  chatAssistRequestSchema,
  chatSummaryRequestSchema,
]);

// --- Structured model outputs -----------------------------------------------

export function chatDiagnoseOutputSchema(misconceptionIds: string[]) {
  const misconceptionId = z.enum(misconceptionIds as [string, ...string[]]);
  return z.object({
    /** null when the learner's explanation shows no meaningful gap. */
    primaryMisconceptionId: misconceptionId.nullable(),
    reasoning: z.string(),
    explanation: z.string().nullable(),
    example: z.string().nullable(),
    takeaway: z.string().nullable(),
    probeQuestion: z.string().nullable(),
  });
}

export const chatCheckOutputSchema = z.object({
  verdict: chatVerdictSchema,
  feedback: z
    .string()
    .refine((text) => text.trim().length >= 20, {
      message:
        "feedback must be one to three full sentences for the learner, not just the verdict word",
    }),
  /**
   * Teaches one small piece before the next question; only for a "build"
   * move, where the learner is missing or shaky on an idea. Otherwise null.
   */
  teaching: z.string().nullable(),
  /** What the next question is for; null when there is no next question. */
  nextMove: z.enum(chatMoves).nullable(),
  /** The next question, or null when the conversation is complete. */
  nextProbeQuestion: z.string().nullable(),
  /**
   * A one-sentence nudge, set instead of revealing the answer when a first
   * attempt misses; the learner then retries the same question.
   */
  hint: z.string().nullable(),
});

export const chatAssistOutputSchema = z.object({
  reply: z.string().refine((text) => text.trim().length >= 20, {
    message: "reply must be a few full sentences for the learner",
  }),
  /** A simpler question to answer now in place of the current one, or null. */
  question: z.string().nullable(),
});

export const chatSummaryOutputSchema = z.object({
  understood: z.array(z.string()).max(4),
  fixed: z.array(z.string()).max(4),
  /** Shaky ideas; each also becomes a review flashcard. */
  revisit: z
    .array(
      z.object({
        idea: z.string(),
        /** The flashcard's front: a short question that tests the idea. */
        question: z.string(),
        /** The flashcard's back: the correct answer in one or two sentences. */
        answer: z.string(),
      }),
    )
    .max(3),
});

/** Verdict from the reviewer that checks a hint doesn't give the answer away. */
export const leakCheckOutputSchema = z.object({
  leaks: z.boolean(),
  /** Safe replacement feedback when it leaked; null if there was no feedback to check. */
  feedback: z.string().nullable(),
  /** Safe replacement hint when it leaked; the original otherwise. */
  hint: z.string(),
});
