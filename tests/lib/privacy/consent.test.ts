import { beforeEach, describe, expect, it, vi } from "vitest";

const { limit, insert, gte } = vi.hoisted(() => ({
  limit: vi.fn(),
  insert: vi.fn(),
  gte: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit }) }) }),
      insert,
      delete: () => ({ gte }),
    }),
  }),
}));

import { eraseLog, hasConsent, recordConsent, POLICY_VERSION } from "@/lib/privacy/consent";

beforeEach(() => {
  limit.mockReset();
  insert.mockReset();
  gte.mockReset();
});

describe("hasConsent", () => {
  it("follows the newest record", async () => {
    limit.mockResolvedValue({ data: [{ granted: true }], error: null });
    expect(await hasConsent("product_improvement")).toBe(true);
    limit.mockResolvedValue({ data: [{ granted: false }], error: null });
    expect(await hasConsent("product_improvement")).toBe(false);
  });

  it("is false with no record, on an error, or when the client throws", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    expect(await hasConsent("product_improvement")).toBe(false);
    limit.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await hasConsent("product_improvement")).toBe(false);
    limit.mockRejectedValue(new Error("offline"));
    expect(await hasConsent("product_improvement")).toBe(false);
  });
});

describe("recordConsent", () => {
  it("appends a record stamped with the policy version", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await recordConsent("product_improvement", true)).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      purpose: "product_improvement",
      granted: true,
      policy_version: POLICY_VERSION,
    });
  });

  it("returns false when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "x" } });
    expect(await recordConsent("product_improvement", false)).toBe(false);
  });
});

describe("eraseLog", () => {
  it("deletes the learner's log rows and reports success or failure", async () => {
    gte.mockResolvedValue({ error: null });
    expect(await eraseLog()).toBe(true);
    gte.mockResolvedValue({ error: { message: "x" } });
    expect(await eraseLog()).toBe(false);
    gte.mockRejectedValue(new Error("offline"));
    expect(await eraseLog()).toBe(false);
  });
});
