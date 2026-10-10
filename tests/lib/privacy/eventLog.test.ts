import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  after: vi.fn(),
  getVerifiedUser: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/lib/supabase/user", () => ({ getVerifiedUser: m.getVerifiedUser }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: m.insert }) }),
}));

import { logChatEvent, type ChatEvent } from "@/lib/privacy/eventLog";

const event: ChatEvent = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  conceptId: "overfitting",
  turn: 2,
  misconceptionId: "of-train-accuracy-proves",
  result: "hinted",
  learnerText: "mail me at jo@uni.de about   this",
};

/** Runs the callback logChatEvent handed to after(). */
async function flush() {
  const callback = m.after.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;
  await callback?.();
}

function user(consents: { granted: boolean }[] | null, error = false) {
  m.limit.mockResolvedValue(error ? { data: null, error: { message: "x" } } : { data: consents, error: null });
  m.getVerifiedUser.mockResolvedValue({
    id: "u1",
    supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: m.limit }) }) }) }) },
  });
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.after.mockImplementation(() => {});
  m.insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("logChatEvent", () => {
  it("stores a scrubbed excerpt when the learner has consented", async () => {
    user([{ granted: true }]);
    logChatEvent(event);
    await flush();
    expect(m.insert).toHaveBeenCalledWith({
      user_id: "u1",
      session_id: event.sessionId,
      concept_id: "overfitting",
      turn: 2,
      misconception_id: "of-train-accuracy-proves",
      result: "hinted",
      excerpt: "mail me at [email] about this",
    });
  });

  it("stores nothing when consent was withdrawn, missing or can't be read", async () => {
    for (const setup of [() => user([{ granted: false }]), () => user([]), () => user(null, true)]) {
      m.insert.mockClear();
      m.after.mockClear();
      setup();
      logChatEvent(event);
      await flush();
      expect(m.insert).not.toHaveBeenCalled();
    }
  });

  it("stores nothing without an account", async () => {
    m.getVerifiedUser.mockResolvedValue(null);
    logChatEvent(event);
    await flush();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("does nothing at all without a session id", () => {
    logChatEvent({ ...event, sessionId: undefined });
    expect(m.after).not.toHaveBeenCalled();
  });

  it("never throws: not outside a request, not when the insert fails", async () => {
    m.after.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    expect(() => logChatEvent(event)).not.toThrow();

    m.after.mockReset().mockImplementation(() => {});
    user([{ granted: true }]);
    m.insert.mockResolvedValue({ error: { message: "db down" } });
    logChatEvent(event);
    await expect(flush()).resolves.toBeUndefined();
  });
});
