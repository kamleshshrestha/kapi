import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConcept } from "@/lib/learning/concepts";
import { getMisconception } from "@/lib/learning/misconceptions";
import { generateStructured } from "@/lib/llm/client";
import { chatCheckPrompt } from "@/lib/llm/prompts";
import { chatCheckOutputSchema } from "@/lib/llm/schemas";

const good =
  "You correctly said the weights stay the same until the optimizer step, which shows you separate gradients from updates.";

describe("chatCheckOutputSchema feedback", () => {
  it("accepts real sentences", () => {
    expect(
      chatCheckOutputSchema.safeParse({ verdict: "resolved", feedback: good, nextProbeQuestion: null, hint: null }).success,
    ).toBe(true);
  });

  it.each(["resolved", "partial", "unresolved", "", "   ", "Well done!"])(
    "rejects too-short feedback %j",
    (feedback) => {
      const result = chatCheckOutputSchema.safeParse({
        verdict: "resolved",
        feedback,
        nextProbeQuestion: null,
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
      .mockResolvedValueOnce(reply({ verdict: "resolved", feedback: "resolved", nextProbeQuestion: null, hint: null }))
      .mockResolvedValueOnce(reply({ verdict: "resolved", feedback: good, nextProbeQuestion: null, hint: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      system: "s",
      user: "u",
      schema: chatCheckOutputSchema,
    });

    expect(result).toEqual({
      verdict: "resolved",
      feedback: good,
      nextProbeQuestion: null,
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
  });

  it("asks for full sentences, not just the verdict word", () => {
    expect(system).toMatch(/never just the verdict word/i);
  });

  it("tells the model to credit only what the learner actually wrote", () => {
    expect(system).toMatch(/actually wrote/i);
    expect(system).toMatch(/never attribute a correct idea/i);
  });
});
