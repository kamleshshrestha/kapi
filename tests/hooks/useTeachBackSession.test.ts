// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTeachBackSession } from "@/hooks/useTeachBackSession";
import { readLevels } from "@/lib/learning/v2/levelStore";
import { TEACH_TURNS } from "@/lib/learning/v2/chatFlow";

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
const asked = (reply_: string) => reply({ reply: reply_, done: false, assessment: null });
const finished = (verdict: "solid" | "partial" | "shaky") =>
  reply({
    reply: "Thanks, that makes sense!",
    done: true,
    assessment: { verdict, clear: ["It memorises."], gaps: ["Test data shows it."] },
  });

const setup = () => renderHook(() => useTeachBackSession("overfitting", "Overfitting"));
const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("useTeachBackSession", () => {
  it("opens with Kapi playing a beginner, without calling the server", () => {
    const { result } = setup();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toContain("total beginner");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends each explanation with the conversation so far and the turn number", async () => {
    const { result } = setup();
    asked("Why is that bad?");
    act(() => result.current.submit("  It memorises the data.  "));
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(bodyOf(0)).toMatchObject({
      conceptId: "overfitting",
      phase: "teach",
      explanation: "It memorises the data.",
      turn: 1,
      history: [{ role: "kapi", text: expect.stringContaining("beginner") }],
    });
    expect(result.current.turn).toBe(2);
    expect(result.current.done).toBe(false);
    expect(result.current.assessment).toBeNull();
  });

  it("records Defend evidence only for a solid explanation", async () => {
    const { result } = setup();
    for (let i = 1; i < TEACH_TURNS; i++) {
      asked("And?");
      act(() => result.current.submit(`part ${i}`));
      await waitFor(() => expect(result.current.turn).toBe(i + 1));
    }
    finished("solid");
    act(() => result.current.submit("last part"));
    await waitFor(() => expect(result.current.done).toBe(true));
    expect(result.current.assessment?.verdict).toBe("solid");
    expect(readLevels("overfitting").defend).toMatchObject({ clean: 1, helped: 0 });
  });

  it.each(["partial", "shaky"] as const)("records nothing for a %s explanation", async (verdict) => {
    const { result } = setup();
    finished(verdict);
    act(() => result.current.submit("something"));
    await waitFor(() => expect(result.current.done).toBe(true));
    expect(readLevels("overfitting").defend).toBeUndefined();
  });

  it("ignores input once finished", async () => {
    const { result } = setup();
    finished("partial");
    act(() => result.current.submit("something"));
    await waitFor(() => expect(result.current.done).toBe(true));
    act(() => result.current.submit("more"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the learner's message on failure and retries the very same request", async () => {
    const { result } = setup();
    reply({ error: "Busy" }, 503);
    act(() => result.current.submit("It memorises."));
    await waitFor(() => expect(result.current.error).toBe("Busy"));
    expect(result.current.canRetry).toBe(true);
    expect(result.current.messages.at(-1)).toEqual({ role: "learner", text: "It memorises." });

    asked("Why is that bad?");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(bodyOf(1)).toEqual(bodyOf(0));
    expect(result.current.error).toBeNull();
    expect(result.current.canRetry).toBe(false);
  });
});
