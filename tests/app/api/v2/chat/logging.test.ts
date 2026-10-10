import { beforeEach, describe, expect, it, vi } from "vitest";

const { logChatEvent } = vi.hoisted(() => ({ logChatEvent: vi.fn() }));
vi.mock("@/lib/privacy/eventLog", () => ({ logChatEvent }));
vi.mock("@/lib/llm/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm/client")>()),
  generateStructured: vi.fn(),
}));

import { POST } from "@/app/api/v2/chat/route";
import { generateStructured } from "@/lib/llm/client";

const generate = vi.mocked(generateStructured);
const SESSION = "22222222-2222-4222-8222-222222222222";
let ip = 100;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/v2/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip}` },
      body: JSON.stringify(body),
    }),
  );
}

const check = {
  conceptId: "overfitting",
  phase: "check",
  sessionId: SESSION,
  misconceptionId: "of-train-accuracy-proves",
  probeQuestion: "Train 99%, test 70%: is it good?",
  answer: "No, the test score matters.",
  history: [],
  turn: 2,
};

const feedback = "That is right: the test score is what shows generalisation.";

beforeEach(() => {
  generate.mockReset();
  logChatEvent.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("chat route feeds the opt-in log", () => {
  it("logs the diagnosis with the learner's explanation", async () => {
    generate.mockResolvedValue({
      primaryMisconceptionId: "of-train-accuracy-proves",
      reasoning: "You rely on the training score.",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: "Is 99% train enough?",
    });
    await post({ conceptId: "overfitting", phase: "diagnose", sessionId: SESSION, explanation: "Train score is what matters." });
    expect(logChatEvent).toHaveBeenCalledWith({
      sessionId: SESSION,
      conceptId: "overfitting",
      turn: 0,
      misconceptionId: "of-train-accuracy-proves",
      result: "diagnosed",
      learnerText: "Train score is what matters.",
    });
  });

  it("maps a resolved answer to 'correct'", async () => {
    generate.mockResolvedValue({ verdict: "resolved", feedback, teaching: null, nextMove: null, nextProbeQuestion: null, hint: null });
    await post(check);
    expect(logChatEvent).toHaveBeenCalledWith(
      expect.objectContaining({ turn: 2, result: "correct", learnerText: "No, the test score matters.", misconceptionId: "of-train-accuracy-proves" }),
    );
  });

  it("maps a first miss with a hint to 'hinted' and a second miss to 'revealed'", async () => {
    // The leak-check reviewer is a second generateStructured call; let it pass the text through.
    generate
      .mockResolvedValueOnce({ verdict: "unresolved", feedback, teaching: null, nextMove: null, nextProbeQuestion: null, hint: "Think about unseen data." })
      .mockResolvedValueOnce({ leaks: false, feedback: null, hint: "Think about unseen data." });
    await post({ ...check, attempt: 1 });
    expect(logChatEvent).toHaveBeenLastCalledWith(expect.objectContaining({ result: "hinted" }));

    generate.mockResolvedValueOnce({ verdict: "unresolved", feedback, teaching: null, nextMove: "build", nextProbeQuestion: "Next?", hint: null });
    await post({ ...check, attempt: 2 });
    expect(logChatEvent).toHaveBeenLastCalledWith(expect.objectContaining({ result: "revealed" }));
  });

  it("does not log assist or summary phases", async () => {
    generate.mockResolvedValue({ reply: "Here is a gentle nudge for you to think about.", question: null });
    await post({ conceptId: "overfitting", phase: "assist", kind: "rephrase", misconceptionId: "of-train-accuracy-proves", probeQuestion: "Q?", history: [] });
    expect(logChatEvent).not.toHaveBeenCalled();
  });

  it("rejects a malformed session id", async () => {
    const res = await post({ ...check, sessionId: "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(logChatEvent).not.toHaveBeenCalled();
  });
});
