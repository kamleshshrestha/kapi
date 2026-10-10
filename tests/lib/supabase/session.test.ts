import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signInAnonymously = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, signInAnonymously } }),
}));

import { ensureAnonymousSession } from "@/lib/supabase/session";

describe("ensureAnonymousSession", () => {
  beforeEach(() => {
    getUser.mockReset();
    signInAnonymously.mockReset();
  });

  it("reuses an existing session without signing in again", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await ensureAnonymousSession()).toBe("u1");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in anonymously when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    expect(await ensureAnonymousSession()).toBe("u2");
  });

  it("returns null when sign-in fails, so the app stays local-only", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: "Anonymous sign-ins are disabled" },
    });
    expect(await ensureAnonymousSession()).toBeNull();
  });

  it("returns null when Supabase is not configured or throws", async () => {
    getUser.mockRejectedValue(new Error("Supabase is not configured"));
    expect(await ensureAnonymousSession()).toBeNull();
  });
});
