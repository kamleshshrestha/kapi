import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { updateSession } from "@/lib/supabase/proxy";

describe("updateSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getClaims.mockReset();
  });

  it("passes the request through untouched when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const res = await updateSession(new NextRequest("http://localhost/"));
    expect(res.status).toBe(200);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("verifies the token with getClaims when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    getClaims.mockResolvedValue({ data: null, error: null });
    const res = await updateSession(new NextRequest("http://localhost/"));
    expect(res.status).toBe(200);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });
});
