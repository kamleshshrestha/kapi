import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm/client")>()),
  generateStructured: vi.fn(),
}));

import { POST } from "@/app/api/v2/chat/route";
import { generateStructured, LLMHttpError } from "@/lib/llm/client";

const mockedGenerate = vi.mocked(generateStructured);

let nextIp = 0;
function post(body: unknown) {
  // A fresh address per request keeps the in-memory rate limiter out of the way.
  return POST(
    new Request("http://localhost/api/v2/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${++nextIp}`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const MISCONCEPTION = "of-train-accuracy-proves";

const diagnoseBody = {
  conceptId: "overfitting",
  phase: "diagnose",
  explanation: "The training score is the one that matters.",
};

const checkBody = {
  conceptId: "overfitting",
  phase: "check",
  misconceptionId: "of-train-accuracy-proves",
  probeQuestion: "A model scores 99% on train and 70% on test. Is it good?",
  answer: "No, the test score shows it does not generalise.",
  history: [
    { role: "kapi", text: "Hey! How would you describe overfitting?" },
    { role: "learner", text: "The training score is the one that matters." },
    { role: "kapi", text: "Train 99%, test 70%: is it good?" },
  ],
  turn: 1,
};

beforeEach(() => {
  mockedGenerate.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/v2/chat request validation", () => {
  it("rejects a body that is not valid JSON", async () => {
    const response = await post("{not json");
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("rejects an unknown phase", async () => {
    const response = await post({ ...diagnoseBody, phase: "other" });
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("rejects a check request with no answer", async () => {
    const response = await post({ ...checkBody, answer: undefined });
    expect(response.status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown concept", async () => {
    const response = await post({ ...diagnoseBody, conceptId: "no-such-concept" });
    expect(response.status).toBe(404);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v2/chat diagnose phase", () => {
  it("returns the diagnosis with internal ids scrubbed from every learner-facing field", async () => {
    mockedGenerate.mockResolvedValue({
      primaryMisconceptionId: "of-train-accuracy-proves",
      reasoning: "This matches of-train-accuracy-proves.",
      explanation: "Not of-train-accuracy-proves: train score alone says little.",
      example: "Example for of-train-accuracy-proves.",
      takeaway: "Takeaway (of-train-accuracy-proves).",
      probeQuestion: "Probe about of-train-accuracy-proves?",
    });

    const response = await post(diagnoseBody);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.misconceptionId).toBe("of-train-accuracy-proves");
    for (const field of ["reasoning", "explanation", "example", "takeaway", "probeQuestion"]) {
      expect(json[field], field).not.toMatch(/of-[a-z-]+-/);
    }
  });

  it("passes null fields through when the learner has no meaningful gap", async () => {
    mockedGenerate.mockResolvedValue({
      primaryMisconceptionId: null,
      reasoning: "Your explanation is accurate.",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: null,
    });

    const json = await (await post(diagnoseBody)).json();

    expect(json).toEqual({
      misconceptionId: null,
      reasoning: "Your explanation is accurate.",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: null,
    });
  });

  it("sends the learner's explanation to the model inside the prompt", async () => {
    mockedGenerate.mockResolvedValue({
      primaryMisconceptionId: null,
      reasoning: "ok",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: null,
    });

    await post(diagnoseBody);

    expect(mockedGenerate).toHaveBeenCalledTimes(1);
    const call = mockedGenerate.mock.calls[0][0];
    expect(call.user).toContain(diagnoseBody.explanation);
  });
});

describe("POST /api/v2/chat check phase", () => {
  it("returns the verdict, feedback and next probe", async () => {
    mockedGenerate.mockResolvedValue({
      verdict: "partial",
      feedback: "You are close, but consider a model with low train error too.",
      nextProbeQuestion: "What if train and test scores are both low?",
    });

    const response = await post(checkBody);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      verdict: "partial",
      feedback: "You are close, but consider a model with low train error too.",
      hint: null,
      teaching: null,
      nextMove: "build",
      nextProbeQuestion: "What if train and test scores are both low?",
    });
  });

  it("accepts a null misconception when Kapi is challenging a strong explanation", async () => {
    mockedGenerate.mockResolvedValue({
      verdict: "resolved",
      feedback: "Exactly, a cross-validated score would be more trustworthy.",
      nextProbeQuestion: "What if the test set is tiny?",
    });

    const response = await post({ ...checkBody, misconceptionId: null });

    expect(response.status).toBe(200);
    expect((await response.json()).nextProbeQuestion).toBe("What if the test set is tiny?");
  });

  it("sends the conversation so far, the question and the turn to the model", async () => {
    mockedGenerate.mockResolvedValue({
      verdict: "partial",
      feedback: "You are close, but consider a model with low train error too.",
      nextProbeQuestion: "Another angle?",
    });

    await post({ ...checkBody, turn: 2 });

    const { user, system } = mockedGenerate.mock.calls[0][0];
    expect(user).toContain("Learner: The training score is the one that matters.");
    expect(user).toContain(`Question just asked (a "build" step): ${checkBody.probeQuestion}`);
    expect(system).toContain("question 2 of at most 7");
  });

  it("forces the conversation to end on the final turn even if the model asks more", async () => {
    mockedGenerate.mockResolvedValue({
      verdict: "partial",
      feedback: "You are close, but consider a model with low train error too.",
      nextProbeQuestion: "One more?",
    });

    const json = await (await post({ ...checkBody, turn: 7 })).json();

    expect(json.nextProbeQuestion).toBeNull();
  });

  it("scrubs internal ids from feedback and the next question", async () => {
    mockedGenerate.mockResolvedValue({
      verdict: "unresolved",
      feedback: "This is still of-train-accuracy-proves, since you trusted the train score.",
      nextProbeQuestion: "Think about of-train-accuracy-proves again?",
    });

    const json = await (await post(checkBody)).json();

    expect(json.feedback).not.toMatch(/of-[a-z-]+-/);
    expect(json.nextProbeQuestion).not.toMatch(/of-[a-z-]+-/);
  });

  it("rejects a check request with no history or turn", async () => {
    expect((await post({ ...checkBody, history: undefined, turn: undefined })).status).toBe(400);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns 404 for a misconception id that is not in the catalog", async () => {
    const response = await post({ ...checkBody, misconceptionId: "made-up-id" });
    expect(response.status).toBe(404);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("returns 404 when the misconception belongs to a different concept", async () => {
    const response = await post({ ...checkBody, conceptId: "gradient-descent" });
    expect(response.status).toBe(404);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v2/chat hints", () => {
  const missed = {
    verdict: "unresolved" as const,
    feedback: "Close, but take another look at which score you trust.",
    hint: "Which score can't be memorised?",
    nextProbeQuestion: "Something else?",
  };

  const clean = { leaks: false, feedback: null, hint: missed.hint };

  it("returns the hint on a first miss and withholds the next question", async () => {
    mockedGenerate.mockResolvedValueOnce(missed).mockResolvedValueOnce(clean);

    const json = await (await post(checkBody)).json();

    expect(json.hint).toBe("Which score can't be memorised?");
    expect(json.nextProbeQuestion).toBeNull();
  });

  it("drops the hint once one was already given, and asks the next question", async () => {
    mockedGenerate.mockResolvedValue(missed);

    const json = await (await post({ ...checkBody, attempt: 2 })).json();

    expect(json.hint).toBeNull();
    expect(json.nextProbeQuestion).toBe("Something else?");
  });

  it("never hints on a resolved answer", async () => {
    mockedGenerate.mockResolvedValue({ ...missed, verdict: "resolved" });

    const json = await (await post(checkBody)).json();

    expect(json.hint).toBeNull();
  });

  it("tells the model which attempt it is", async () => {
    mockedGenerate.mockResolvedValue({ ...missed, hint: null });

    await post(checkBody);
    await post({ ...checkBody, attempt: 2 });

    expect(mockedGenerate.mock.calls[0][0].system).toContain("first try");
    expect(mockedGenerate.mock.calls[1][0].system).toContain("already got a hint");
  });

  it("rejects an attempt above 2", async () => {
    expect((await post({ ...checkBody, attempt: 3 })).status).toBe(400);
  });

  it("scrubs ids from a hint", async () => {
    mockedGenerate
      .mockResolvedValueOnce({ ...missed, hint: "Not of-train-accuracy-proves." })
      .mockResolvedValueOnce({ leaks: false, feedback: null, hint: "unused" });

    const json = await (await post(checkBody)).json();

    expect(json.hint).not.toMatch(/of-[a-z-]+-/);
  });
});

describe("POST /api/v2/chat leak check on hints", () => {
  const missed = {
    verdict: "unresolved" as const,
    feedback: "Overfitting means a big train-test gap, which yours lacks.",
    hint: "Compare the two accuracies.",
    nextProbeQuestion: null,
  };

  it("keeps the tutor's feedback and hint when the reviewer finds no leak", async () => {
    mockedGenerate
      .mockResolvedValueOnce(missed)
      .mockResolvedValueOnce({ leaks: false, feedback: "ignored", hint: "ignored" });

    const json = await (await post(checkBody)).json();

    expect(json.feedback).toBe(missed.feedback);
    expect(json.hint).toBe(missed.hint);
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it("replaces both with the reviewer's rewrite when they leak", async () => {
    mockedGenerate.mockResolvedValueOnce(missed).mockResolvedValueOnce({
      leaks: true,
      feedback: "You've got the 90% part; part of your reasoning deserves another look.",
      hint: "What would you compare 90% to?",
    });

    const json = await (await post(checkBody)).json();

    expect(json.feedback).toBe(
      "You've got the 90% part; part of your reasoning deserves another look.",
    );
    expect(json.hint).toBe("What would you compare 90% to?");
    expect(json.nextProbeQuestion).toBeNull();
  });

  it("falls back to neutral feedback when the reviewer says leak but gives none", async () => {
    mockedGenerate
      .mockResolvedValueOnce(missed)
      .mockResolvedValueOnce({ leaks: true, feedback: null, hint: "Safe hint." });

    const json = await (await post(checkBody)).json();

    expect(json.feedback).toMatch(/another look/i);
    expect(json.feedback).not.toContain("train-test gap");
    expect(json.hint).toBe("Safe hint.");
  });

  it("swaps the feedback for neutral text, keeping the hint, when the reviewer fails", async () => {
    mockedGenerate.mockResolvedValueOnce(missed).mockImplementationOnce(async () => {
      throw new Error("overloaded");
    });

    const response = await post(checkBody);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.feedback).toMatch(/another look/i);
    expect(json.feedback).not.toContain("train-test gap");
    expect(json.hint).toBe(missed.hint);
  });

  it("scrubs ids from a rewrite", async () => {
    mockedGenerate.mockResolvedValueOnce(missed).mockResolvedValueOnce({
      leaks: true,
      feedback: "Rethink of-train-accuracy-proves.",
      hint: "Not of-train-accuracy-proves.",
    });

    const json = await (await post(checkBody)).json();

    expect(json.feedback).not.toMatch(/of-[a-z-]+-/);
    expect(json.hint).not.toMatch(/of-[a-z-]+-/);
  });

  it("gives the reviewer the question, the correct idea and both texts, but not the learner's answer", async () => {
    mockedGenerate
      .mockResolvedValueOnce(missed)
      .mockResolvedValueOnce({ leaks: false, feedback: null, hint: missed.hint });

    await post(checkBody);

    const { system, user } = mockedGenerate.mock.calls[1][0];
    expect(user).toContain(`Question asked: ${checkBody.probeQuestion}`);
    expect(user).toContain(missed.feedback);
    expect(user).toContain(missed.hint);
    expect(user).not.toContain(checkBody.answer);
    expect(system).toContain("The correct idea the learner is meant to reach");
  });

  it("does not run the reviewer when there is no hint to check", async () => {
    mockedGenerate.mockResolvedValue({ ...missed, verdict: "resolved", nextProbeQuestion: "Next?" });
    await post(checkBody);

    mockedGenerate.mockResolvedValue({ ...missed, nextProbeQuestion: "Next?" });
    await post({ ...checkBody, attempt: 2 });

    // One call per request: no reviewer for a resolved answer or a second attempt.
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it("also checks a 'give me a hint' reply, but not the other kinds of help", async () => {
    const assistBody = {
      conceptId: "overfitting",
      phase: "assist",
      misconceptionId: MISCONCEPTION,
      probeQuestion: checkBody.probeQuestion,
      history: [],
    };

    mockedGenerate
      .mockResolvedValueOnce({ reply: "It is overfit when test is much worse.", question: null })
      .mockResolvedValueOnce({ leaks: true, feedback: null, hint: "Which score can't be memorised?" });
    const hint = await (await post({ ...assistBody, kind: "hint" })).json();
    expect(hint.reply).toBe("Which score can't be memorised?");
    expect(mockedGenerate).toHaveBeenCalledTimes(2);

    mockedGenerate.mockResolvedValue({ reply: "Let's go smaller, step by step.", question: "Q?" });
    await post({ ...assistBody, kind: "lost" });
    await post({ ...assistBody, kind: "rephrase" });
    expect(mockedGenerate).toHaveBeenCalledTimes(4);
  });
});

describe("POST /api/v2/chat assist phase", () => {
  const assistBody = {
    conceptId: "overfitting",
    phase: "assist",
    kind: "lost",
    misconceptionId: MISCONCEPTION,
    probeQuestion: "Train 99%, test 70%: is it good?",
    history: [{ role: "kapi", text: "Train 99%, test 70%: is it good?" }],
  };

  it("returns the reply and a simpler question when the learner is lost", async () => {
    mockedGenerate.mockResolvedValue({
      reply: "No problem, let's take a smaller step.",
      question: "What does the test score measure?",
    });

    const response = await post(assistBody);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: "No problem, let's take a smaller step.",
      question: "What does the test score measure?",
    });
  });

  it("keeps the current question for a hint even if the model offers another", async () => {
    mockedGenerate.mockResolvedValue({
      reply: "Think about which score you can't memorise.",
      question: "An unwanted replacement?",
    });

    const json = await (await post({ ...assistBody, kind: "hint" })).json();

    expect(json.question).toBeNull();
  });

  it("uses a prompt specific to the kind of help", async () => {
    mockedGenerate.mockResolvedValue({ reply: "x".repeat(30), question: null });

    await post({ ...assistBody, kind: "rephrase" });

    expect(mockedGenerate.mock.calls[0][0].system).toContain("explain it differently");
  });

  it("rejects an unknown kind and an unknown misconception", async () => {
    expect((await post({ ...assistBody, kind: "cheat" })).status).toBe(400);
    expect((await post({ ...assistBody, misconceptionId: "nope" })).status).toBe(404);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("scrubs ids from the reply", async () => {
    mockedGenerate.mockResolvedValue({
      reply: "You're stuck on of-train-accuracy-proves, so let's simplify.",
      question: null,
    });

    const json = await (await post(assistBody)).json();

    expect(json.reply).not.toMatch(/of-[a-z-]+-/);
  });
});

describe("POST /api/v2/chat summary phase", () => {
  const summaryBody = {
    conceptId: "overfitting",
    phase: "summary",
    misconceptionId: MISCONCEPTION,
    history: [
      { role: "learner", text: "The training score is the one that matters." },
      { role: "kapi", text: "Train 99%, test 70%: is it good?" },
    ],
    verdicts: ["partial", "resolved"],
  };

  it("returns the three recap lists, scrubbed, with flashcard fields on revisit items", async () => {
    mockedGenerate.mockResolvedValue({
      understood: ["The test score shows generalisation."],
      fixed: ["You fixed of-train-accuracy-proves."],
      revisit: [
        {
          idea: "Regularisation, see of-train-accuracy-proves.",
          question: "What does L2 regularisation do?",
          answer: "It shrinks the weights.",
        },
      ],
    });

    const response = await post(summaryBody);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.understood).toEqual(["The test score shows generalisation."]);
    expect(json.fixed[0]).not.toMatch(/of-[a-z-]+-/);
    expect(json.revisit).toEqual([
      {
        idea: expect.not.stringMatching(/of-[a-z-]+-/),
        question: "What does L2 regularisation do?",
        answer: "It shrinks the weights.",
      },
    ]);
  });

  it("sends the verdicts and the full transcript to the model", async () => {
    mockedGenerate.mockResolvedValue({ understood: [], fixed: [], revisit: [] });

    await post(summaryBody);

    const { user } = mockedGenerate.mock.calls[0][0];
    expect(user).toContain("partial, resolved");
    expect(user).toContain("Learner: The training score is the one that matters.");
  });

  it("works with no misconception, and rejects an invalid verdict", async () => {
    mockedGenerate.mockResolvedValue({ understood: [], fixed: [], revisit: [] });

    expect((await post({ ...summaryBody, misconceptionId: null })).status).toBe(200);
    expect((await post({ ...summaryBody, verdicts: ["great"] })).status).toBe(400);
  });
});

describe("POST /api/v2/chat upstream failures", () => {
  it("maps an upstream 429 to a 429 for the client", async () => {
    mockedGenerate.mockImplementation(async () => {
      throw new LLMHttpError(429, "rate limited");
    });

    const response = await post(diagnoseBody);
    expect(response.status).toBe(429);
  });

  it("maps any other model failure to a 502", async () => {
    mockedGenerate.mockImplementation(async () => {
      throw new Error("boom");
    });

    const response = await post(checkBody);
    expect(response.status).toBe(502);
  });
});

describe("POST /api/v2/chat build, check, challenge flow", () => {
  const next = {
    feedback: "You've got the idea that the test score matters here.",
    hint: null,
    nextProbeQuestion: "What happens with a tiny test set?",
  };

  it("never challenges a learner who has not answered correctly, and builds instead", async () => {
    mockedGenerate.mockResolvedValue({
      ...next,
      verdict: "partial",
      nextMove: "challenge",
      teaching: "A tiny test set gives a noisy score.",
    });

    const json = await (await post({ ...checkBody, attempt: 2, move: "check" })).json();

    expect(json.nextMove).toBe("build");
    expect(json.teaching).toBe("A tiny test set gives a noisy score.");
  });

  it("does not jump from a build step straight to a challenge", async () => {
    mockedGenerate.mockResolvedValue({
      ...next,
      verdict: "resolved",
      nextMove: "challenge",
      teaching: null,
    });

    const json = await (await post({ ...checkBody, move: "build" })).json();

    expect(json.nextMove).toBe("check");
  });

  it("lets a learner who answered a check step well move on to a challenge", async () => {
    mockedGenerate.mockResolvedValue({
      ...next,
      verdict: "resolved",
      nextMove: "challenge",
      teaching: "ignored, only build steps teach",
    });

    const json = await (await post({ ...checkBody, move: "check" })).json();

    expect(json.nextMove).toBe("challenge");
    expect(json.teaching).toBeNull();
  });

  it("withholds teaching on a first-try miss, where the hint must not give the answer away", async () => {
    mockedGenerate
      .mockResolvedValueOnce({
        ...next,
        verdict: "unresolved",
        hint: "Which score can't be memorised?",
        nextMove: "build",
        teaching: "The test score is the honest one.",
      })
      .mockResolvedValueOnce({ leaks: false, feedback: null, hint: "Which score can't be memorised?" });

    const json = await (await post(checkBody)).json();

    expect(json.teaching).toBeNull();
    expect(json.nextMove).toBeNull();
    expect(json.nextProbeQuestion).toBeNull();
  });

  it("has no next move or teaching when the conversation ends", async () => {
    mockedGenerate.mockResolvedValue({
      ...next,
      verdict: "resolved",
      nextProbeQuestion: null,
      nextMove: "challenge",
      teaching: "x",
    });

    const json = await (await post({ ...checkBody, move: "check" })).json();

    expect(json.nextMove).toBeNull();
    expect(json.teaching).toBeNull();
  });

  it("tells the model what the last question was for and the verdicts so far", async () => {
    mockedGenerate.mockResolvedValue({ ...next, verdict: "resolved", nextMove: "check", teaching: null });

    await post({ ...checkBody, move: "check", verdicts: ["partial", "resolved"] });

    const { user, system } = mockedGenerate.mock.calls[0][0];
    expect(user).toContain('Question just asked (a "check" step)');
    expect(system).toContain("partial, resolved");
  });

  it("rejects an unknown move", async () => {
    expect((await post({ ...checkBody, move: "interrogate" })).status).toBe(400);
  });
});
