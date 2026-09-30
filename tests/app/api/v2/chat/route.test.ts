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
      nextProbeQuestion: "What if train and test scores are both low?",
    });
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
