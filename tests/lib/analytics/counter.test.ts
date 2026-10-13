import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ after: vi.fn(), rpc: vi.fn() }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));

import { countEvent, countFloodEvent } from "@/lib/analytics/counter";

/** Runs the n-th callback that was handed to after(). */
async function flush(n = 0) {
  const callback = m.after.mock.calls[n]?.[0] as (() => Promise<void>) | undefined;
  await callback?.();
}

beforeEach(() => {
  m.after.mockReset();
  m.rpc.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("countEvent", () => {
  it("adds one for the event after the response, passing only the values it was given", async () => {
    countEvent("chat_started", { concept: "overfitting" });
    expect(m.rpc).not.toHaveBeenCalled();
    await flush();
    expect(m.rpc).toHaveBeenCalledWith("count_event", {
      p_event: "chat_started",
      p_concept: "overfitting",
      p_detail: "",
      p_count: 1,
    });
  });

  it("passes the detail, and empty strings when there is none", async () => {
    countEvent("teach_finished", { concept: "overfitting", detail: "solid" });
    await flush();
    expect(m.rpc).toHaveBeenCalledWith("count_event", expect.objectContaining({ p_detail: "solid" }));
  });

  it("never throws when the write fails or the call is outside a request", async () => {
    m.rpc.mockResolvedValue({ error: new Error("boom") });
    countEvent("chat_finished", { concept: "overfitting" });
    await expect(flush()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();

    m.after.mockImplementation(() => {
      throw new Error("outside a request");
    });
    expect(() => countEvent("chat_finished")).not.toThrow();
  });

  it("does nothing when Supabase admin access is not configured", async () => {
    m.rpc.mockImplementation(() => {
      throw new Error("Supabase admin access is not configured");
    });
    countEvent("chat_started", { concept: "overfitting" });
    await expect(flush()).resolves.toBeUndefined();
  });
});

describe("countFloodEvent", () => {
  it("writes at most once per interval and carries the number counted since", async () => {
    const t = 1_000_000_000;
    countFloodEvent("rate_limited", t);
    countFloodEvent("rate_limited", t + 1_000);
    countFloodEvent("rate_limited", t + 2_000);
    expect(m.after).toHaveBeenCalledTimes(1);
    await flush(0);
    expect(m.rpc).toHaveBeenLastCalledWith("count_event", expect.objectContaining({ p_event: "rate_limited", p_count: 1 }));

    countFloodEvent("rate_limited", t + 11_000);
    expect(m.after).toHaveBeenCalledTimes(2);
    await flush(1);
    expect(m.rpc).toHaveBeenLastCalledWith("count_event", expect.objectContaining({ p_count: 3 }));
  });
});
