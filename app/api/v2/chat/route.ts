import { getConcept } from "@/lib/learning/concepts";
import {
  getMisconception,
  getMisconceptionsForConcept,
} from "@/lib/learning/misconceptions";
import type { Misconception } from "@/lib/learning/types";
import { generateStructured, llmErrorResponse, parseBody } from "@/lib/llm/client";
import { checkRateLimit } from "@/lib/llm/rate-limit";
import { chatDiagnosePrompt, verificationPrompt } from "@/lib/llm/prompts";
import {
  chatDiagnoseOutputSchema,
  chatTurnRequestSchema,
  verificationOutputSchema,
} from "@/lib/llm/schemas";
import { scrubMisconceptionIds } from "@/lib/llm/scrub";

function scrubNullable(
  text: string | null,
  misconceptions: Misconception[],
): string | null {
  return text === null ? null : scrubMisconceptionIds(text, misconceptions);
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request);
  if (limited) return limited;

  const body = await parseBody(request, chatTurnRequestSchema);
  if (!body.ok) return body.response;
  const data = body.data;

  const concept = getConcept(data.conceptId);
  if (!concept) {
    return Response.json({ error: "Unknown concept" }, { status: 404 });
  }

  try {
    if (data.phase === "diagnose") {
      const misconceptions = getMisconceptionsForConcept(concept.id);
      if (misconceptions.length === 0) {
        return Response.json({ error: "Unknown concept" }, { status: 404 });
      }

      const result = await generateStructured({
        ...chatDiagnosePrompt({
          concept,
          misconceptions,
          explanation: data.explanation,
        }),
        schema: chatDiagnoseOutputSchema(misconceptions.map((m) => m.id)),
      });

      return Response.json({
        misconceptionId: result.primaryMisconceptionId,
        reasoning: scrubMisconceptionIds(result.reasoning, misconceptions),
        explanation: scrubNullable(result.explanation, misconceptions),
        example: scrubNullable(result.example, misconceptions),
        takeaway: scrubNullable(result.takeaway, misconceptions),
        probeQuestion: scrubNullable(result.probeQuestion, misconceptions),
      });
    }

    // data.phase === "check"
    const misconception = getMisconception(data.misconceptionId);
    if (!misconception || misconception.conceptId !== concept.id) {
      return Response.json({ error: "Unknown misconception" }, { status: 404 });
    }

    const result = await generateStructured({
      ...verificationPrompt({
        concept,
        misconception,
        question: data.probeQuestion,
        answer: data.answer,
      }),
      schema: verificationOutputSchema,
    });

    return Response.json({ verdict: result.verdict, feedback: result.feedback });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
