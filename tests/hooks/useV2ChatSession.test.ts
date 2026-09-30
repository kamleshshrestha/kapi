// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useV2ChatSession } from "@/hooks/useV2ChatSession";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";
import { readPersonalCards } from "@/lib/learning/v2/personalCards";

const MISCONCEPTION_ID = "of-train-accuracy-proves";
const OPTIONS = ["It memorises the data", "It generalises well"];
const LONG_TEXT = "The training score is the one that matters most.";

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );
}

function diagnoseReply(overrides: Record<string, unknown> = {}) {
  reply({
    misconceptionId: MISCONCEPTION_ID,
    reasoning: "You're leaning on the training score.",
    explanation: "But that only shows memorisation.",
    example: "A model can score 99% on train.",
    takeaway: "Always check held-out data.",
    probeQuestion: "Train 99%, test 70%: is it good?",
    ...overrides,
  });
}

function checkReply(
  verdict: "resolved" | "partial" | "unresolved",
  nextProbeQuestion: string | null = null,
) {
  reply({ verdict, feedback: `Feedback for ${verdict}.`, nextProbeQuestion });
}

function setup() {
  return renderHook(() =>
    useV2ChatSession("overfitting", "Overfitting", OPTIONS),
  );
}

/** Mount and submit an explanation so the session reaches the check phase. */
async function reachCheckPhase() {
  diagnoseReply();
  const hook = setup();
  act(() => hook.result.current.submit(LONG_TEXT));
  await waitFor(() => expect(hook.result.current.phase).toBe("await-check-answer"));
  return hook;
}

function lastBody(callIndex = fetchMock.mock.calls.length - 1) {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body);
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("useV2ChatSession opener", () => {
  it("starts with one Kapi opener mentioning the concept and makes no API call", async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].role).toBe("kapi");
    expect(result.current.messages[0].text).toContain("Overfitting");
    expect(result.current.phase).toBe("await-explanation");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the welcome-back opener when a previous session exists", async () => {
    writeLastSession("overfitting", {
      misconceptionId: MISCONCEPTION_ID,
      misconceptionTitle: "Good training score proves learning",
      resolved: true,
      at: new Date().toISOString(),
    });

    const { result } = setup();

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].text).toContain("back for Overfitting");
    expect(result.current.messages[0].text).toContain(
      "Good training score proves learning",
    );
  });
});

describe("useV2ChatSession explanation phase", () => {
  it("skips the API and offers quick replies for a thin explanation", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => result.current.submit("dunno"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.quickReplies).toEqual(OPTIONS);
    expect(result.current.phase).toBe("await-explanation");
    expect(result.current.messages.map((m) => m.role)).toEqual([
      "kapi",
      "learner",
      "kapi",
    ]);
  });

  it("ignores blank submissions", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => result.current.submit("   "));

    expect(result.current.messages).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the diagnose request and walks through the returned messages", async () => {
    const { result } = await reachCheckPhase();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/chat",
      expect.objectContaining({ method: "POST" }),
    );
    expect(lastBody(0)).toEqual({
      conceptId: "overfitting",
      phase: "diagnose",
      explanation: LONG_TEXT,
    });
    expect(result.current.messages.map((m) => m.text).slice(1)).toEqual([
      LONG_TEXT,
      "You're leaning on the training score. But that only shows memorisation.",
      "A model can score 99% on train. Always check held-out data.",
      "Train 99%, test 70%: is it good?",
    ]);
    expect(result.current.pending).toBe(false);
    expect(result.current.quickReplies).toBeNull();
  });

  it("finishes the session when no misconception is found", async () => {
    diagnoseReply({
      misconceptionId: null,
      reasoning: "Your explanation is accurate.",
      explanation: null,
      example: null,
      takeaway: null,
      probeQuestion: null,
    });
    const { result } = setup();

    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(result.current.messages.at(-1)?.text).toBe(
      "Your explanation is accurate.",
    );
  });

  it("surfaces the server's error message and stays in the explanation phase", async () => {
    reply({ error: "The free AI model is busy." }, 429);
    const { result } = setup();

    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() =>
      expect(result.current.error).toBe("The free AI model is busy."),
    );

    expect(result.current.phase).toBe("await-explanation");
    expect(result.current.pending).toBe(false);
  });

  it("reports a network failure in plain words", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = setup();

    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.error).toMatch(/couldn't reach/i));
  });

  it("clears a previous error on the next attempt", async () => {
    reply({ error: "Boom" }, 502);
    const { result } = setup();
    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.error).toBe("Boom"));

    diagnoseReply();
    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() =>
      expect(result.current.phase).toBe("await-check-answer"),
    );
    expect(result.current.error).toBeNull();
  });
});

describe("useV2ChatSession check phase", () => {
  it("posts the check request with the misconception and current probe", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");

    act(() => result.current.submit("No, test score matters."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(lastBody()).toEqual({
      conceptId: "overfitting",
      phase: "check",
      misconceptionId: MISCONCEPTION_ID,
      probeQuestion: "Train 99%, test 70%: is it good?",
      answer: "No, test score matters.",
    });
  });

  it("on resolved, saves a flashcard and records the session", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");

    act(() => result.current.submit("No, test score matters."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(readPersonalCards("overfitting")).toEqual([
      expect.objectContaining({
        misconceptionId: MISCONCEPTION_ID,
        front: "Train 99%, test 70%: is it good?",
        back: "Feedback for resolved.",
      }),
    ]);
    expect(readLastSession("overfitting")).toMatchObject({
      misconceptionId: MISCONCEPTION_ID,
      resolved: true,
    });
  });

  it("on partial, asks the next probe and uses it for the following check", async () => {
    const { result } = await reachCheckPhase();
    checkReply("partial", "What if both scores are low?");

    act(() => result.current.submit("Maybe."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toBe(
        "What if both scores are low?",
      ),
    );
    expect(result.current.phase).toBe("await-check-answer");
    expect(readPersonalCards("overfitting")).toEqual([]);

    checkReply("resolved");
    act(() => result.current.submit("Then it underfits."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastBody().probeQuestion).toBe("What if both scores are low?");
  });

  it("wraps up unresolved after the third probe without saving a card", async () => {
    const { result } = await reachCheckPhase();

    checkReply("unresolved", "Second probe?");
    act(() => result.current.submit("Not sure one."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toBe("Second probe?"),
    );

    checkReply("unresolved", "Third probe?");
    act(() => result.current.submit("Not sure two."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toBe("Third probe?"),
    );

    checkReply("unresolved", "Fourth probe?");
    act(() => result.current.submit("Not sure three."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(result.current.messages.map((m) => m.text)).not.toContain(
      "Fourth probe?",
    );
    expect(result.current.messages.at(-1)?.text).toMatch(/come back to this/i);
    expect(readPersonalCards("overfitting")).toEqual([]);
    expect(readLastSession("overfitting")).toMatchObject({ resolved: false });
  });

  it("wraps up early when the model offers no next probe", async () => {
    const { result } = await reachCheckPhase();
    checkReply("partial", null);

    act(() => result.current.submit("Hmm."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(readLastSession("overfitting")).toMatchObject({ resolved: false });
  });

  it("keeps the same probe and surfaces the error when the check call fails", async () => {
    const { result } = await reachCheckPhase();
    reply({ error: "Try again shortly." }, 502);

    act(() => result.current.submit("My answer."));
    await waitFor(() => expect(result.current.error).toBe("Try again shortly."));

    expect(result.current.phase).toBe("await-check-answer");
    expect(result.current.pending).toBe(false);
  });

  it("ignores submissions once the session is done", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");
    act(() => result.current.submit("Done answer."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    const calls = fetchMock.mock.calls.length;
    const count = result.current.messages.length;

    act(() => result.current.submit("One more thing"));

    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(result.current.messages).toHaveLength(count);
  });
});
