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

export const chatCheckRequestSchema = z.object({
  conceptId: id,
  phase: z.literal("check"),
  misconceptionId: id,
  probeQuestion: z.string().trim().min(1).max(1000),
  answer: freeText,
});

export const chatTurnRequestSchema = z.discriminatedUnion("phase", [
  chatDiagnoseRequestSchema,
  chatCheckRequestSchema,
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
