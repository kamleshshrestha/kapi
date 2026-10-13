import { beforeEach, describe, expect, it, vi } from "vitest";

const { countEvent } = vi.hoisted(() => ({ countEvent: vi.fn() }));
vi.mock("@/lib/analytics/counter", () => ({ countEvent, countFloodEvent: vi.fn() }));
vi.mock("@/lib/llm/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm/client")>()),
  generateStructured: vi.fn(),
}));

import { POST } from "@/app/api/v2/chat/route";
import { generateStructured, LLMHttpError } from "@/lib/llm/client";
import { TEACH_TURNS } from "@/lib/learning/v2/chatFlow";

const generate = vi.mocked(generateStructured);
let ip = 0;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/v2/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${++ip}` },
      body: JSON.stringify(body),
    }),
  );
}

const teach = {
  conceptId: "overfitting",
  phase: "teach",
  history: [{ role: "kapi", text: "Pretend I'm new. What is overfitting?" }],
  explanation: "It is when a model memorises the training data.",
  turn: 1,
};
const teachOutput = {
  reply: "Oh, so it remembers instead of learns? Why is that bad?",
  assessment: { verdict: "solid", clear: ["It memorises."], gaps: [] },
};

beforeEach(() => {
  generate.mockReset();
  countEvent.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("chat route counts anonymous usage", () => {
  it("counts a started chat on a successful diagnosis, with only the concept id", async () => {
    generate.mockResolvedValue({
      primaryMisconceptionId: null,
      reasoning: "ok",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: null,
    });
    await post({ conceptId: "overfitting", phase: "diagnose", explanation: "My secret words" });
    expect(countEvent).toHaveBeenCalledTimes(1);
    expect(countEvent).toHaveBeenCalledWith("chat_started", { concept: "overfitting" });
  });

  it("counts a finished chat when the recap is produced", async () => {
    generate.mockResolvedValue({ understood: ["a"], fixed: [], revisit: [] });
    await post({
      conceptId: "overfitting",
      phase: "summary",
      misconceptionId: "of-train-accuracy-proves",
      history: [{ role: "learner", text: "x" }],
      verdicts: ["resolved"],
    });
    expect(countEvent).toHaveBeenCalledWith("chat_finished", { concept: "overfitting" });
  });

  it("counts teach-it-back at the first message and, with the verdict, at the last", async () => {
    generate.mockResolvedValue(teachOutput);
    await post(teach);
    expect(countEvent.mock.calls).toEqual([["teach_started", { concept: "overfitting" }]]);

    countEvent.mockReset();
    await post({ ...teach, turn: 2 });
    expect(countEvent).not.toHaveBeenCalled();

    await post({ ...teach, turn: TEACH_TURNS });
    expect(countEvent.mock.calls).toEqual([
      ["teach_finished", { concept: "overfitting", detail: "solid" }],
    ]);
  });

  it("counts a model error with the status the learner got, and nothing else", async () => {
    generate.mockRejectedValue(new LLMHttpError(429, "busy"));
    const res = await post({ conceptId: "overfitting", phase: "diagnose", explanation: "x" });
    expect(res.status).toBe(429);
    expect(countEvent.mock.calls).toEqual([["model_error", { concept: "overfitting", detail: "429" }]]);
  });

  it("counts nothing for an invalid request", async () => {
    await post("{not json");
    await post({ conceptId: "no-such-concept", phase: "diagnose", explanation: "x" });
    expect(countEvent).not.toHaveBeenCalled();
  });
});
