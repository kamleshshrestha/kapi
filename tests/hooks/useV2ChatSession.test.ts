// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useV2ChatSession } from "@/hooks/useV2ChatSession";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";
import { readPersonalCards } from "@/lib/learning/v2/personalCards";
import { MAX_CHAT_TURNS } from "@/lib/learning/v2/chatFlow";

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
  hint: string | null = null,
  extra: { teaching?: string | null; nextMove?: "build" | "check" | "challenge" } = {},
) {
  reply({
    verdict,
    feedback: `Feedback for ${verdict}.`,
    nextProbeQuestion,
    hint,
    teaching: extra.teaching ?? null,
    nextMove: nextProbeQuestion ? (extra.nextMove ?? "check") : null,
  });
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

function bodies() {
  return fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
}

function lastBody(phase?: string) {
  const all = bodies().filter((b) => !phase || b.phase === phase);
  return all[all.length - 1];
}

/** The last answer submission, ignoring the recap call that follows a finished chat. */
function lastCheckBody() {
  return lastBody("check");
}

const EMPTY_SUMMARY = { understood: [], fixed: [], revisit: [] };

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  // Unqueued calls are the end-of-chat recap request: answer with an empty one.
  fetchMock.mockImplementation(async () =>
    new Response(JSON.stringify(EMPTY_SUMMARY), { status: 200 }),
  );
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
    expect(bodies()[0]).toEqual({
      conceptId: "overfitting",
      phase: "diagnose",
      explanation: LONG_TEXT,
    });
    // One Kapi message with paragraphs, not a separate bubble per piece.
    expect(result.current.messages.map((m) => m.text).slice(1)).toEqual([
      LONG_TEXT,
      [
        "You're leaning on the training score. But that only shows memorisation.",
        "A model can score 99% on train. Always check held-out data.",
        "Train 99%, test 70%: is it good?",
      ].join("\n\n"),
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

    expect(result.current.messages.at(-1)?.text).toContain(
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
  it("records the diagnosed gap as open right away, before any answer", async () => {
    await reachCheckPhase();

    expect(readLastSession("overfitting")).toMatchObject({
      misconceptionId: MISCONCEPTION_ID,
      resolved: false,
    });
  });

  it("marks the gap resolved as soon as it is answered, even mid-conversation", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved", "Deeper question?");

    act(() => result.current.submit("Test score matters."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("Deeper question?"),
    );

    expect(result.current.phase).toBe("await-check-answer");
    expect(readLastSession("overfitting")).toMatchObject({ resolved: true });
  });

  it("posts the check request with the misconception and current probe", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");

    act(() => result.current.submit("No, test score matters."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    const body = lastCheckBody();
    expect(body).toMatchObject({
      conceptId: "overfitting",
      phase: "check",
      misconceptionId: MISCONCEPTION_ID,
      probeQuestion: "Train 99%, test 70%: is it good?",
      answer: "No, test score matters.",
      turn: 1,
    });
    // The thread before this answer: opener, explanation, and Kapi's one diagnosis message.
    expect(body.history).toHaveLength(3);
    expect(body.history.at(-1)).toMatchObject({ role: "kapi" });
    expect(body.history.at(-1).text).toMatch(/Train 99%, test 70%: is it good\?$/);
    expect(body.history[1]).toEqual({ role: "learner", text: LONG_TEXT });
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
      expect(result.current.messages.at(-1)?.text).toContain(
        "What if both scores are low?",
      ),
    );
    expect(result.current.phase).toBe("await-check-answer");
    expect(readPersonalCards("overfitting")).toEqual([]);

    checkReply("resolved");
    act(() => result.current.submit("Then it underfits."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody().probeQuestion).toBe("What if both scores are low?");
  });

  it("keeps the conversation going through every allowed question, then wraps up without saving a card", async () => {
    const { result } = await reachCheckPhase();

    for (let turn = 1; turn < MAX_CHAT_TURNS; turn++) {
      checkReply("unresolved", `Probe ${turn + 1}?`);
      act(() => result.current.submit(`Not sure ${turn}.`));
      await waitFor(() =>
        expect(result.current.messages.at(-1)?.text).toContain(`Probe ${turn + 1}?`),
      );
      expect(lastCheckBody().turn).toBe(turn);
    }

    checkReply("unresolved", "Extra probe?");
    act(() => result.current.submit(`Not sure ${MAX_CHAT_TURNS}.`));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(lastCheckBody().turn).toBe(MAX_CHAT_TURNS);
    expect(result.current.messages.some((m) => m.text.includes("Extra probe?"))).toBe(false);
    expect(result.current.messages.at(-1)?.text).toMatch(/come back to this/i);
    expect(readPersonalCards("overfitting")).toEqual([]);
    expect(readLastSession("overfitting")).toMatchObject({ resolved: false });
  });

  it("keeps going deeper after a resolved answer, adding a card for each answered question", async () => {
    const { result } = await reachCheckPhase();

    checkReply("resolved", "Now, what if the test set is tiny?");
    act(() => result.current.submit("Test score matters."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain(
        "Now, what if the test set is tiny?",
      ),
    );
    expect(result.current.phase).toBe("await-check-answer");
    expect(readPersonalCards("overfitting")).toHaveLength(1);
    const savedFront = readPersonalCards("overfitting")[0].front;
    expect(savedFront).toBe("Train 99%, test 70%: is it good?");

    checkReply("resolved", null);
    act(() => result.current.submit("Then the estimate is noisy."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    const cards = readPersonalCards("overfitting");
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe(savedFront);
    expect(cards[1]).toMatchObject({
      front: "Now, what if the test set is tiny?",
      misconceptionId: null,
      kind: "resolved",
    });
    expect(readLastSession("overfitting")).toMatchObject({ resolved: true });
    expect(
      result.current.messages.some((m) => /come back to this/i.test(m.text)),
    ).toBe(false);
  });

  it("does not say 'come back later' if the gap was resolved earlier in the chat", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved", "Deeper question?");
    act(() => result.current.submit("Answer one."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("Deeper question?"),
    );

    checkReply("partial", null);
    act(() => result.current.submit("Answer two."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(result.current.messages.at(-1)?.text).not.toMatch(/come back to this/i);
    expect(readLastSession("overfitting")).toMatchObject({ resolved: true });
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

describe("useV2ChatSession strong explanation", () => {
  const strongReply = {
    misconceptionId: null,
    reasoning: "That's a precise explanation; you separated train from test well.",
    explanation: null,
    example: null,
    takeaway: null,
    probeQuestion: "What if the test set is very small?",
  };

  async function reachChallenge() {
    diagnoseReply(strongReply);
    const hook = setup();
    act(() => hook.result.current.submit(LONG_TEXT));
    await waitFor(() => expect(hook.result.current.phase).toBe("await-check-answer"));
    return hook;
  }

  it("compliments the learner, then asks a challenging question instead of ending", async () => {
    const { result } = await reachChallenge();

    expect(result.current.messages.at(-1)?.text).toBe(
      `${strongReply.reasoning}\n\n${strongReply.probeQuestion}`,
    );
  });

  it("sends a null misconception for the challenge follow-up and saves the answered question as a flashcard", async () => {
    const { result } = await reachChallenge();
    checkReply("resolved", "And with heavy class imbalance?");

    act(() => result.current.submit("Then the estimate is noisy."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain(
        "And with heavy class imbalance?",
      ),
    );

    expect(lastCheckBody()).toMatchObject({ phase: "check", misconceptionId: null, turn: 1 });
    expect(readPersonalCards("overfitting")).toEqual([
      expect.objectContaining({
        front: strongReply.probeQuestion,
        misconceptionId: null,
        kind: "resolved",
      }),
    ]);
  });

  it("ends without recording a last session when the challenge rounds finish", async () => {
    const { result } = await reachChallenge();
    checkReply("resolved", null);

    act(() => result.current.submit("Then the estimate is noisy."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(readLastSession("overfitting")).toBeNull();
    expect(result.current.messages.at(-1)?.text).not.toMatch(/come back to this/i);
  });
});

describe("useV2ChatSession hints", () => {
  it("gives a hint on a first miss and lets the learner retry the same question", async () => {
    const { result } = await reachCheckPhase();
    checkReply("unresolved", null, "Think about which score you can't memorise.");

    act(() => result.current.submit("It's good."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain(
        "Think about which score you can't memorise.",
      ),
    );

    expect(result.current.phase).toBe("await-check-answer");
    expect(lastCheckBody()).toMatchObject({ turn: 1, attempt: 1 });

    checkReply("resolved");
    act(() => result.current.submit("The test score matters."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    // Same question, second attempt, and the question count did not move.
    expect(lastCheckBody()).toMatchObject({
      turn: 1,
      attempt: 2,
      probeQuestion: "Train 99%, test 70%: is it good?",
    });
  });

  it("moves on after a second miss instead of hinting again", async () => {
    const { result } = await reachCheckPhase();
    checkReply("unresolved", null, "A nudge.");
    act(() => result.current.submit("Wrong one."));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("A nudge."));

    checkReply("unresolved", "A new angle?");
    act(() => result.current.submit("Wrong two."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("A new angle?"),
    );

    expect(result.current.phase).toBe("await-check-answer");
    // A fresh question starts over at attempt 1 of the next turn.
    checkReply("resolved");
    act(() => result.current.submit("Right now."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody()).toMatchObject({ turn: 2, attempt: 1 });
  });

  it("does not record a verdict for a hinted attempt", async () => {
    const { result } = await reachCheckPhase();
    checkReply("unresolved", null, "A nudge.");
    act(() => result.current.submit("Wrong."));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("A nudge."));
    checkReply("resolved");
    act(() => result.current.submit("Right."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    await waitFor(() => expect(lastBody("summary")).toBeDefined());

    expect(lastBody("summary").verdicts).toEqual(["resolved"]);
  });
});

describe("useV2ChatSession assist", () => {
  it("adds a hint reply without advancing the question", async () => {
    const { result } = await reachCheckPhase();
    reply({ reply: "Think about unseen data.", question: null });

    act(() => void result.current.assist("hint"));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("Think about unseen data."),
    );

    expect(lastBody("assist")).toMatchObject({
      phase: "assist",
      kind: "hint",
      misconceptionId: MISCONCEPTION_ID,
      probeQuestion: "Train 99%, test 70%: is it good?",
    });
    expect(result.current.messages.at(-2)).toEqual({
      role: "learner",
      text: "Give me a hint",
    });
    expect(result.current.phase).toBe("await-check-answer");

    // The next answer is still to the original question, at turn 1.
    checkReply("resolved");
    act(() => result.current.submit("The test score matters."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody()).toMatchObject({
      turn: 1,
      probeQuestion: "Train 99%, test 70%: is it good?",
    });
  });

  it("replaces the question with a simpler one when the learner is lost", async () => {
    const { result } = await reachCheckPhase();
    reply({ reply: "No problem, let's go smaller.", question: "What does 'test score' measure?" });

    act(() => void result.current.assist("lost"));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("What does 'test score' measure?"),
    );

    checkReply("resolved");
    act(() => result.current.submit("Performance on unseen data."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody().probeQuestion).toBe("What does 'test score' measure?");
  });

  it("surfaces an error from the assist call and stays on the question", async () => {
    const { result } = await reachCheckPhase();
    reply({ error: "Busy." }, 429);

    act(() => void result.current.assist("rephrase"));
    await waitFor(() => expect(result.current.error).toBe("Busy."));

    expect(result.current.phase).toBe("await-check-answer");
    expect(result.current.pending).toBe(false);
  });

  it("ignores assist requests outside the question phase", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => void result.current.assist("hint"));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useV2ChatSession recap flashcards", () => {
  const WITH_REVISIT = {
    understood: [],
    fixed: [],
    revisit: [
      {
        idea: "Regularisation",
        question: "What does L2 regularisation do?",
        answer: "It shrinks the weights.",
      },
      { idea: "Blank", question: "  ", answer: "No question, so no card." },
    ],
  };

  it("saves each revisit item as a flashcard and reports how many were added", async () => {
    const { result } = await reachCheckPhase();
    checkReply("partial");
    reply(WITH_REVISIT);

    act(() => result.current.submit("Not sure."));
    await waitFor(() => expect(result.current.summary).toEqual(WITH_REVISIT));

    expect(result.current.savedCards).toBe(1);
    expect(readPersonalCards("overfitting")).toEqual([
      expect.objectContaining({
        kind: "revisit",
        misconceptionId: null,
        front: "What does L2 regularisation do?",
        back: "It shrinks the weights.",
      }),
    ]);
  });

  it("keeps the resolved card alongside the revisit cards", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved", "Deeper?");
    act(() => result.current.submit("Answer one."));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("Deeper?"));

    checkReply("partial");
    reply(WITH_REVISIT);
    act(() => result.current.submit("Answer two."));
    await waitFor(() => expect(result.current.savedCards).toBe(1));

    expect(readPersonalCards("overfitting").map((c) => c.kind).sort()).toEqual([
      "resolved",
      "revisit",
    ]);
  });

  it("saves nothing when there is nothing to revisit", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");
    reply({ understood: ["x"], fixed: [], revisit: [] });

    act(() => result.current.submit("Answer."));
    await waitFor(() => expect(result.current.summary).not.toBeNull());

    expect(result.current.savedCards).toBe(0);
    expect(readPersonalCards("overfitting").every((c) => c.kind !== "revisit")).toBe(true);
  });
});

describe("useV2ChatSession recap", () => {
  const SUMMARY = {
    understood: ["Test score is what shows generalisation."],
    fixed: ["A high train score does not prove learning."],
    revisit: [],
  };

  it("requests a recap with the transcript and verdicts when the chat ends, and exposes it", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");
    reply(SUMMARY);

    act(() => result.current.submit("The test score matters."));
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));

    const body = lastBody("summary");
    expect(body).toMatchObject({
      phase: "summary",
      misconceptionId: MISCONCEPTION_ID,
      verdicts: ["resolved"],
    });
    expect(body.history.at(-2)).toEqual({
      role: "learner",
      text: "The test score matters.",
    });
    expect(body.history.at(-1)).toEqual({ role: "kapi", text: "Feedback for resolved." });
    expect(result.current.summarizing).toBe(false);
  });

  it("does not request a recap while the chat is still going", async () => {
    const { result } = await reachCheckPhase();
    checkReply("partial", "Another question?");

    act(() => result.current.submit("Maybe."));
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("Another question?"),
    );

    expect(lastBody("summary")).toBeUndefined();
    expect(result.current.summary).toBeNull();
  });

  it("does not request a recap when the diagnosis had nothing to probe", async () => {
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

    expect(lastBody("summary")).toBeUndefined();
  });

  it("finishes quietly, with no error, when the recap call fails", async () => {
    const { result } = await reachCheckPhase();
    checkReply("resolved");
    reply({ error: "Busy." }, 502);

    act(() => result.current.submit("The test score matters."));
    await waitFor(() => expect(lastBody("summary")).toBeDefined());
    await waitFor(() => expect(result.current.summarizing).toBe(false));

    expect(result.current.phase).toBe("done");
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe("useV2ChatSession retry", () => {
  const learnerTexts = (messages: { role: string; text: string }[]) =>
    messages.filter((m) => m.role === "learner").map((m) => m.text);

  it("cannot retry before anything has failed", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    expect(result.current.canRetry).toBe(false);
    act(() => result.current.retry());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-sends a failed explanation without retyping or duplicating the message", async () => {
    reply({ error: "The AI service failed to respond. Please try again." }, 502);
    const { result } = setup();
    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    diagnoseReply();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.phase).toBe("await-check-answer"));

    expect(bodies()).toHaveLength(2);
    expect(bodies()[1]).toEqual(bodies()[0]);
    expect(learnerTexts(result.current.messages)).toEqual([LONG_TEXT]);
    expect(result.current.error).toBeNull();
    expect(result.current.canRetry).toBe(false);
  });

  it("re-sends a failed answer with the same history, question and turn", async () => {
    const { result } = await reachCheckPhase();
    reply({ error: "Busy." }, 429);
    act(() => result.current.submit("My answer."));
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    checkReply("resolved");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.phase).toBe("done"));

    const checks = bodies().filter((b) => b.phase === "check");
    expect(checks).toHaveLength(2);
    // Identical request: the failed answer is not in its own history.
    expect(checks[1]).toEqual(checks[0]);
    expect(checks[1].history.map((m: { text: string }) => m.text)).not.toContain("My answer.");
    expect(learnerTexts(result.current.messages).filter((t) => t === "My answer.")).toHaveLength(1);
  });

  it("re-sends a failed help request without adding a second chat line", async () => {
    const { result } = await reachCheckPhase();
    reply({ error: "Busy." }, 502);
    act(() => void result.current.assist("hint"));
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    reply({ reply: "Think about unseen data.", question: null });
    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.text).toContain("Think about unseen data."),
    );

    expect(bodies().filter((b) => b.phase === "assist")).toHaveLength(2);
    expect(
      result.current.messages.filter((m) => m.text === "Give me a hint"),
    ).toHaveLength(1);
  });

  it("can retry again if the retry fails too", async () => {
    reply({ error: "Busy." }, 502);
    const { result } = setup();
    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    reply({ error: "Still busy." }, 502);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe("Still busy."));
    await waitFor(() => expect(result.current.canRetry).toBe(true));
  });

  it("drops the pending retry when the learner sends something new", async () => {
    reply({ error: "Busy." }, 502);
    const { result } = setup();
    act(() => result.current.submit(LONG_TEXT));
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    diagnoseReply();
    act(() => result.current.submit("A different, longer explanation."));
    await waitFor(() => expect(result.current.phase).toBe("await-check-answer"));

    expect(result.current.canRetry).toBe(false);
  });
});

describe("useV2ChatSession one message per turn", () => {
  it("answers with a single Kapi message: feedback then the next question", async () => {
    const { result } = await reachCheckPhase();
    const before = result.current.messages.length;
    checkReply("resolved", "Now, what if the test set is tiny?");

    act(() => result.current.submit("Test score matters."));
    await waitFor(() => expect(result.current.messages).toHaveLength(before + 2));

    expect(result.current.messages.slice(before)).toEqual([
      { role: "learner", text: "Test score matters." },
      {
        role: "kapi",
        text: "Feedback for resolved.\n\nNow, what if the test set is tiny?",
      },
    ]);
  });

  it("puts the feedback and hint of a first miss in one message", async () => {
    const { result } = await reachCheckPhase();
    const before = result.current.messages.length;
    checkReply("unresolved", null, "Think about unseen data.");

    act(() => result.current.submit("It's good."));
    await waitFor(() => expect(result.current.messages).toHaveLength(before + 2));

    expect(result.current.messages.at(-1)?.text).toBe(
      "Feedback for unresolved.\n\nThink about unseen data.",
    );
  });

  it("puts the closing line in the same message as the final feedback and recaps it", async () => {
    const { result } = await reachCheckPhase();
    const before = result.current.messages.length;
    checkReply("partial", null);

    act(() => result.current.submit("Hmm."));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    expect(result.current.messages).toHaveLength(before + 2);
    const wrapUp = result.current.messages.at(-1)?.text ?? "";
    expect(wrapUp).toMatch(/^Feedback for partial\.\n\nNo worries/);
    await waitFor(() => expect(lastBody("summary")).toBeDefined());
    expect(lastBody("summary").history.at(-1)).toEqual({ role: "kapi", text: wrapUp });
  });

  it("puts an assist reply and its simpler question in one message", async () => {
    const { result } = await reachCheckPhase();
    const before = result.current.messages.length;
    reply({ reply: "No problem, let's go smaller.", question: "What does 'test score' measure?" });

    act(() => void result.current.assist("lost"));
    await waitFor(() => expect(result.current.messages).toHaveLength(before + 2));

    expect(result.current.messages.at(-1)?.text).toBe(
      "No problem, let's go smaller.\n\nWhat does 'test score' measure?",
    );
  });
});

describe("useV2ChatSession build, check, challenge flow", () => {
  it("starts a gap with a build step and a strong explanation with a challenge step", async () => {
    const gap = await reachCheckPhase();
    checkReply("resolved");
    act(() => gap.result.current.submit("Answer."));
    await waitFor(() => expect(gap.result.current.phase).toBe("done"));
    expect(lastCheckBody().move).toBe("build");

    fetchMock.mockClear();
    diagnoseReply({ misconceptionId: null, explanation: null, example: null, takeaway: null });
    const strong = setup();
    act(() => strong.result.current.submit(LONG_TEXT));
    await waitFor(() => expect(strong.result.current.phase).toBe("await-check-answer"));
    checkReply("resolved");
    act(() => strong.result.current.submit("Answer."));
    await waitFor(() => expect(strong.result.current.phase).toBe("done"));
    expect(lastCheckBody().move).toBe("challenge");
  });

  it("shows the teaching between the feedback and the next question in one message", async () => {
    const { result } = await reachCheckPhase();
    const before = result.current.messages.length;
    checkReply("partial", "So what does the test score tell you?", null, {
      teaching: "Think of the test score as an exam on questions the model never studied.",
      nextMove: "build",
    });

    act(() => result.current.submit("Maybe train?"));
    await waitFor(() => expect(result.current.messages).toHaveLength(before + 2));

    expect(result.current.messages.at(-1)?.text).toBe(
      [
        "Feedback for partial.",
        "Think of the test score as an exam on questions the model never studied.",
        "So what does the test score tell you?",
      ].join("\n\n"),
    );
  });

  it("sends what the last question was for and the verdicts so far with each answer", async () => {
    const { result } = await reachCheckPhase();
    checkReply("partial", "Easier question?", null, { nextMove: "build" });
    act(() => result.current.submit("Unsure."));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("Easier question?"));
    expect(lastCheckBody()).toMatchObject({ move: "build", verdicts: [] });

    checkReply("resolved", "Apply it here?", null, { nextMove: "check" });
    act(() => result.current.submit("Got it."));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("Apply it here?"));
    expect(lastCheckBody()).toMatchObject({ move: "build", verdicts: ["partial"] });

    checkReply("resolved");
    act(() => result.current.submit("Applied."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody()).toMatchObject({ move: "check", verdicts: ["partial", "resolved"] });
  });

  it("treats a simpler question from 'I'm lost' as a build step", async () => {
    const { result } = await reachCheckPhase();
    reply({ reply: "No problem, let's go smaller.", question: "What does 'test score' measure?" });
    act(() => void result.current.assist("lost"));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain("What does 'test score' measure?"));

    checkReply("resolved");
    act(() => result.current.submit("Performance on unseen data."));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(lastCheckBody().move).toBe("build");
  });
});
