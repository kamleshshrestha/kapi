import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/config";

describe("supabase config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns null when either variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(getSupabaseConfig()).toBeNull();
    expect(() => requireSupabaseConfig()).toThrow("not configured");
  });

  it("returns both values when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(getSupabaseConfig()).toEqual({
      url: "https://x.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });
});
