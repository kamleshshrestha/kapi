import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConcept } from "@/lib/learning/concepts";
import { getMisconception } from "@/lib/learning/misconceptions";
import { generateStructured } from "@/lib/llm/client";
import { chatCheckPrompt } from "@/lib/llm/prompts";
import {
  accuracyCheckOutputSchema,
  chatCheckOutputSchema,
  chatQuestionOutputSchema,
} from "@/lib/llm/schemas";

const good =
  "You correctly said the weights stay the same until the optimizer step, which shows you separate gradients from updates.";

describe("chatCheckOutputSchema feedback", () => {
  it("accepts real sentences", () => {
    expect(
      chatCheckOutputSchema.safeParse({ verdict: "resolved", feedback: good, nextProbeQuestion: null, nextMove: null, teaching: null, hint: null }).success,
    ).toBe(true);
  });

  it.each(["resolved", "partial", "unresolved", "", "   ", "Well done!"])(
    "rejects too-short feedback %j",
    (feedback) => {
      const result = chatCheckOutputSchema.safeParse({
        verdict: "resolved",
        feedback,
        nextProbeQuestion: null,
        nextMove: null,
        teaching: null,
        hint: null,
      });
      expect(result.success).toBe(false);
      expect(z.prettifyError(result.error!)).toMatch(/verdict word/);
    },
  );

  it("does not add a length keyword to the JSON schema sent to the provider", () => {
    // Some providers mishandle unsupported keywords in strict structured output.
    const feedback = z.toJSONSchema(chatCheckOutputSchema).properties?.feedback;
    expect(feedback).toEqual({ type: "string" });
  });
});

describe("chatCheckOutputSchema learnerIntent", () => {
  const base = {
    verdict: "resolved",
    feedback: "That is exactly it, the gap between the two scores is the giveaway.",
    nextProbeQuestion: null,
    nextMove: null,
    teaching: null,
    hint: null,
  };

  it("defaults to treating a message as an answer", () => {
    const result = chatCheckOutputSchema.safeParse(base);
    expect(result.success && result.data.learnerIntent).toBe("answer");
  });

  it("accepts a question and rejects anything else", () => {
    expect(
      chatCheckOutputSchema.safeParse({ ...base, learnerIntent: "question" }).success,
    ).toBe(true);
    expect(
      chatCheckOutputSchema.safeParse({ ...base, learnerIntent: "rambling" }).success,
    ).toBe(false);
  });

  it("is required of the model, so the default is only a fallback", () => {
    // strict JSON-schema mode needs every field listed; a missing one would
    // silently become "answer" and grade a question as a wrong attempt.
    expect(z.toJSONSchema(chatCheckOutputSchema).required).toContain("learnerIntent");
  });
});

describe("accuracyCheckOutputSchema", () => {
  const clean = {
    accurate: true,
    problem: null,
    quote: null,
    truth: null,
    working: null,
    explanation: "Real data is noisy, so no straight line hits every point.",
    example: null,
    takeaway: null,
  };

  it("accepts a clean review and one that flags with its working shown", () => {
    expect(accuracyCheckOutputSchema.safeParse(clean).success).toBe(true);
    expect(
      accuracyCheckOutputSchema.safeParse({
        ...clean,
        accurate: false,
        problem: "The boundary is not the line between those two points.",
        quote: "The boundary is the straight line between them.",
        truth: "The boundary is where the score is zero.",
        working: "2*3-1-1 = 4, so (3,1) is not on the boundary.",
      }).success,
    ).toBe(true);
  });

  it("requires the grounding fields, so a complaint cannot be a bare assertion", () => {
    // Dropping them is what let the judge invent problems it could not quote.
    for (const field of ["quote", "truth", "working"]) {
      const partial: Record<string, unknown> = { ...clean };
      delete partial[field];
      expect(accuracyCheckOutputSchema.safeParse(partial).success).toBe(false);
    }
  });

  it("asks the model for every field, so none is silently defaulted", () => {
    expect(z.toJSONSchema(accuracyCheckOutputSchema).required).toEqual(
      expect.arrayContaining(["accurate", "problem", "quote", "truth", "working"]),
    );
  });
});

describe("chatQuestionOutputSchema", () => {
  it("requires a reply of a few sentences", () => {
    expect(chatQuestionOutputSchema.safeParse({ reply: "Yes." }).success).toBe(false);
    expect(
      chatQuestionOutputSchema.safeParse({
        reply: "Squaring keeps the sign out of it. Now, back to my question.",
      }).success,
    ).toBe(true);
  });
});

describe("chat feedback that is only the verdict word", () => {
  const reply = (content: object) =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));

  beforeEach(() => vi.stubEnv("OPENROUTER_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is re-asked, and the model is told why", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ verdict: "resolved", feedback: "resolved", nextProbeQuestion: null, nextMove: null, teaching: null, hint: null }))
      .mockResolvedValueOnce(reply({ verdict: "resolved", feedback: good, nextProbeQuestion: null, nextMove: null, teaching: null, hint: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      system: "s",
      user: "u",
      schema: chatCheckOutputSchema,
    });

    expect(result).toEqual({
      learnerIntent: "answer",
      verdict: "resolved",
      feedback: good,
      nextProbeQuestion: null,
      nextMove: null,
      teaching: null,
      hint: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(secondBody.messages.at(-1).content).toMatch(/not just the verdict word/);
  });
});

describe("chatCheckPrompt", () => {
  const { system } = chatCheckPrompt({
    concept: getConcept("backpropagation")!,
    misconception: getMisconception("bp-updates-weights")!,
    question: "q",
    answer: "a",
    history: [],
    turn: 1,
    maxTurns: 5,
    attempt: 1,
    move: "build" as const,
    verdicts: ["unresolved"],
  });

  it("asks for full sentences, not just the verdict word", () => {
    expect(system).toMatch(/never just the verdict word/i);
  });

  it("describes the build, check and challenge steps and forbids challenging a learner who is unsure", () => {
    expect(system).toMatch(/- build:/);
    expect(system).toMatch(/- check:/);
    expect(system).toMatch(/- challenge:/);
    expect(system).toMatch(/never challenge a learner who is still unsure/i);
  });

  it("tells the model what the last question was for and how the learner has done", () => {
    const { user, system: s2 } = chatCheckPrompt({
      concept: getConcept("backpropagation")!,
      misconception: null,
      question: "q",
      answer: "a",
      history: [],
      turn: 2,
      maxTurns: 7,
      attempt: 1,
      move: "check",
      verdicts: ["partial", "resolved"],
    });
    expect(user).toContain('Question just asked (a "check" step): q');
    expect(s2).toContain("partial, resolved");
  });

  it("tells the model to credit only what the learner actually wrote", () => {
    expect(system).toMatch(/actually wrote/i);
    expect(system).toMatch(/never attribute a correct idea/i);
  });
});
