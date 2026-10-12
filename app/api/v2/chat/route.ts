import { getConcept } from "@/lib/learning/concepts";
import {
  getMisconception,
  getMisconceptionsForConcept,
} from "@/lib/learning/misconceptions";
import type { Misconception } from "@/lib/learning/types";
import type { ChatMove } from "@/lib/llm/schemas";
import { CHAT_HISTORY_LIMIT, MAX_CHAT_TURNS, TEACH_TURNS } from "@/lib/learning/v2/chatFlow";
import { generateStructured, llmErrorResponse, parseBody } from "@/lib/llm/client";
import { checkRateLimit } from "@/lib/llm/rate-limit";
import {
  chatAssistPrompt,
  chatCheckPrompt,
  chatDiagnosePrompt,
  chatSummaryPrompt,
  chatTeachPrompt,
} from "@/lib/llm/prompts";
import {
  chatAssistOutputSchema,
  chatCheckOutputSchema,
  chatDiagnoseOutputSchema,
  chatSummaryOutputSchema,
  chatTeachOutputSchema,
  chatTurnRequestSchema,
} from "@/lib/llm/schemas";
import { scrubMisconceptionIds } from "@/lib/llm/scrub";
import { guardAgainstLeak } from "@/lib/llm/leakGuard";
import { logChatEvent } from "@/lib/privacy/eventLog";

function scrubNullable(
  text: string | null,
  misconceptions: Misconception[],
): string | null {
  return text === null ? null : scrubMisconceptionIds(text, misconceptions);
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request);
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

      logChatEvent({
        sessionId: data.sessionId,
        conceptId: concept.id,
        turn: 0,
        misconceptionId: result.primaryMisconceptionId,
        result: "diagnosed",
        learnerText: data.explanation,
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

    if (data.phase === "teach") {
      const misconceptions = getMisconceptionsForConcept(concept.id);
      if (misconceptions.length === 0) {
        return Response.json({ error: "Unknown concept" }, { status: 404 });
      }
      const clean = (text: string) => scrubMisconceptionIds(text, misconceptions);
      // The number of turns is fixed here, not left to the model or the client.
      const done = data.turn >= TEACH_TURNS;

      const result = await generateStructured({
        ...chatTeachPrompt({
          concept,
          misconceptions,
          history: data.history.slice(-CHAT_HISTORY_LIMIT),
          explanation: data.explanation,
          turn: data.turn,
          maxTurns: TEACH_TURNS,
        }),
        schema: chatTeachOutputSchema,
      });

      return Response.json({
        reply: clean(result.reply),
        done,
        // Only revealed at the end, so the beginner's questions don't grade the learner.
        assessment: done
          ? {
              verdict: result.assessment.verdict,
              clear: result.assessment.clear.map(clean),
              gaps: result.assessment.gaps.map(clean),
            }
          : null,
      });
    }

    // Every remaining phase may refer to a misconception; null means the
    // learner's first explanation was strong and Kapi is challenging it.
    const misconception =
      data.misconceptionId === null ? null : (getMisconception(data.misconceptionId) ?? null);
    if (data.misconceptionId !== null && misconception?.conceptId !== concept.id) {
      return Response.json({ error: "Unknown misconception" }, { status: 404 });
    }
    const conceptMisconceptions = getMisconceptionsForConcept(concept.id);
    const history = data.history.slice(-CHAT_HISTORY_LIMIT);

    if (data.phase === "assist") {
      const result = await generateStructured({
        ...chatAssistPrompt({
          concept,
          misconception,
          question: data.probeQuestion,
          history,
          kind: data.kind,
        }),
        schema: chatAssistOutputSchema,
      });

      let reply = scrubMisconceptionIds(result.reply, conceptMisconceptions);
      if (data.kind === "hint") {
        ({ hint: reply } = await guardAgainstLeak({
          concept,
          misconception,
          question: data.probeQuestion,
          feedback: null,
          hint: reply,
          misconceptions: conceptMisconceptions,
        }));
      }

      return Response.json({
        reply,
        // Only "lost" swaps the question; a hint or rephrase keeps the current one.
        question:
          data.kind === "lost" ? scrubNullable(result.question, conceptMisconceptions) : null,
      });
    }

    if (data.phase === "summary") {
      const result = await generateStructured({
        ...chatSummaryPrompt({
          concept,
          misconception,
          history: data.history,
          verdicts: data.verdicts,
        }),
        schema: chatSummaryOutputSchema,
      });

      const clean = (text: string) => scrubMisconceptionIds(text, conceptMisconceptions);
      return Response.json({
        understood: result.understood.map(clean),
        fixed: result.fixed.map(clean),
        revisit: result.revisit.map((r) => ({
          idea: clean(r.idea),
          question: clean(r.question),
          answer: clean(r.answer),
        })),
      });
    }

    // data.phase === "check"
    const result = await generateStructured({
      ...chatCheckPrompt({
        concept,
        misconception,
        question: data.probeQuestion,
        answer: data.answer,
        history,
        turn: data.turn,
        maxTurns: MAX_CHAT_TURNS,
        attempt: data.attempt,
        move: data.move,
        verdicts: data.verdicts,
      }),
      schema: chatCheckOutputSchema,
    });

    // A hint is only for a first miss; otherwise move on (or finish).
    let feedback = scrubMisconceptionIds(result.feedback, conceptMisconceptions);
    let hint =
      data.attempt === 1 && result.verdict !== "resolved"
        ? scrubNullable(result.hint ?? null, conceptMisconceptions)
        : null;
    if (hint !== null) {
      const guarded = await guardAgainstLeak({
        concept,
        misconception,
        question: data.probeQuestion,
        feedback,
        hint,
        misconceptions: conceptMisconceptions,
      });
      feedback = guarded.feedback ?? feedback;
      hint = guarded.hint;
    }
    // The model is told when to stop, but the cap is enforced here. While a
    // hint is out, the learner retries the same question.
    const nextProbeQuestion =
      hint !== null || data.turn >= MAX_CHAT_TURNS
        ? null
        : scrubNullable(result.nextProbeQuestion, conceptMisconceptions);

    // The flow rules are enforced here too, not only asked of the model: no
    // challenging a learner who has not answered correctly, and no jumping
    // from building straight to challenging without a check in between.
    let nextMove: ChatMove | null = null;
    if (nextProbeQuestion !== null) {
      nextMove = result.nextMove ?? "check";
      if (result.verdict !== "resolved") nextMove = "build";
      else if (nextMove === "challenge" && data.move === "build") nextMove = "check";
    }

    // Teaching only accompanies a "build" question, and never on a first-try
    // miss, where the learner retries and the answer must stay hidden.
    const teaching =
      nextMove === "build" && (result.verdict === "resolved" || data.attempt > 1)
        ? scrubNullable(result.teaching ?? null, conceptMisconceptions)
        : null;

    logChatEvent({
      sessionId: data.sessionId,
      conceptId: concept.id,
      turn: data.turn,
      misconceptionId: data.misconceptionId,
      result: result.verdict === "resolved" ? "correct" : hint !== null ? "hinted" : "revealed",
      learnerText: data.answer,
    });

    return Response.json({
      verdict: result.verdict,
      feedback,
      hint,
      teaching,
      nextMove,
      nextProbeQuestion,
    });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
