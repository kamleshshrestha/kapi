import { z } from "zod";

// --- Request bodies (validated in the route handlers) -----------------------

const id = z.string().min(1).max(100);
const freeText = z.string().trim().min(1).max(2000);

export const diagnoseRequestSchema = z.object({
  conceptId: id,
  answers: z.record(id, id),
  explanation: freeText,
});

export const explainRequestSchema = z.object({
  conceptId: id,
  misconceptionId: id,
  /** The learner's own words, used to tailor the explanation. */
  explanation: freeText,
});

export const verifyRequestSchema = z.object({
  conceptId: id,
  misconceptionId: id,
  question: z.string().trim().min(1).max(1000),
  answer: freeText,
});

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
  verdicts: z.array(z.enum(["resolved", "partial", "unresolved"])).max(20),
});

export const chatTurnRequestSchema = z.discriminatedUnion("phase", [
  chatDiagnoseRequestSchema,
  chatCheckRequestSchema,
  chatAssistRequestSchema,
  chatSummaryRequestSchema,
]);

// --- Structured model outputs -----------------------------------------------

/** Built per request so the model can only pick ids from the catalog. */
export function diagnosisOutputSchema(misconceptionIds: string[]) {
  const misconceptionId = z.enum(misconceptionIds as [string, ...string[]]);
  return z.object({
    /** null when the learner's understanding looks correct. */
    primaryMisconceptionId: misconceptionId.nullable(),
    secondaryMisconceptionIds: z.array(misconceptionId),
    reasoning: z.string(),
  });
}

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

export const explanationOutputSchema = z.object({
  explanation: z.string(),
  example: z.string(),
  takeaway: z.string(),
  verificationQuestion: z.string(),
});

export const verificationOutputSchema = z.object({
  verdict: z.enum(["resolved", "partial", "unresolved"]),
  // A refine rather than min(): it stays out of the JSON schema sent to the
  // provider, and its message is what the model sees when it is asked again.
  feedback: z
    .string()
    .refine((text) => text.trim().length >= 20, {
      message:
        "feedback must be two or three full sentences for the learner, not just the verdict word",
    }),
});

export const chatCheckOutputSchema = z.object({
  verdict: z.enum(["resolved", "partial", "unresolved"]),
  feedback: z
    .string()
    .refine((text) => text.trim().length >= 20, {
      message:
        "feedback must be two or three full sentences for the learner, not just the verdict word",
    }),
  /** null when resolved; a fresh, different scenario otherwise. */
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
