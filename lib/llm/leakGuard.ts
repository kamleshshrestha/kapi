import type { Concept, Misconception } from "@/lib/learning/types";
import { generateStructured } from "@/lib/llm/client";
import { leakCheckPrompt } from "@/lib/llm/prompts";
import { leakCheckOutputSchema } from "@/lib/llm/schemas";
import { scrubMisconceptionIds } from "@/lib/llm/scrub";

/** Shown in place of the tutor's feedback when a leak can't be checked or fixed. */
export const NEUTRAL_FEEDBACK = "You've got part of this. Take another look before we move on.";

/**
 * Output check for first-try feedback and hints: the prompt forbids revealing
 * the answer, but models slip, so a reviewer call checks the text and rewrites
 * it if it leaks. If the reviewer itself fails, the feedback (which is where
 * leaks were seen) is swapped for neutral text rather than shown unchecked.
 */
export async function guardAgainstLeak(args: {
  concept: Concept;
  misconception: Misconception | null;
  question: string;
  feedback: string | null;
  hint: string;
  misconceptions: Misconception[];
}): Promise<{ feedback: string | null; hint: string }> {
  const { misconceptions, ...context } = args;
  try {
    const review = await generateStructured({
      ...leakCheckPrompt(context),
      schema: leakCheckOutputSchema,
    });
    if (!review.leaks) return { feedback: args.feedback, hint: args.hint };
    return {
      feedback:
        args.feedback === null
          ? null
          : scrubMisconceptionIds(review.feedback ?? NEUTRAL_FEEDBACK, misconceptions),
      hint: scrubMisconceptionIds(review.hint, misconceptions),
    };
  } catch (error) {
    console.error("[llm] leak check failed", error);
    return {
      feedback: args.feedback === null ? null : NEUTRAL_FEEDBACK,
      hint: args.hint,
    };
  }
}
