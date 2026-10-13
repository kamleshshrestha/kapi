import { afterEach, describe, expect, it, vi } from "vitest";

const { countFloodEvent } = vi.hoisted(() => ({ countFloodEvent: vi.fn() }));
vi.mock("@/lib/analytics/counter", () => ({ countFloodEvent }));

import { createRateLimiter, getClientId } from "@/lib/llm/rate-limit";

describe("createRateLimiter", () => {
  function limiter(options: { limit?: number; maxKeys?: number } = {}) {
    let time = 1_000;
    const rl = createRateLimiter({
      limit: options.limit ?? 2,
      windowMs: 10_000,
      maxKeys: options.maxKeys,
      now: () => time,
    });
    return { rl, advance: (ms: number) => (time += ms) };
  }

  it("allows up to the limit, then blocks with the time left in the window", () => {
    const { rl, advance } = limiter();
    expect(rl.check("a")).toEqual({ ok: true });
    advance(3_000);
    expect(rl.check("a")).toEqual({ ok: true });
    advance(1_000);
    expect(rl.check("a")).toEqual({ ok: false, retryAfterMs: 6_000 });
  });

  it("does not count blocked attempts", () => {
    const { rl, advance } = limiter({ limit: 1 });
    rl.check("a");
    for (let i = 0; i < 5; i++) rl.check("a");
    advance(10_000);
    expect(rl.check("a")).toEqual({ ok: true });
  });

  it("resets once the window has passed", () => {
    const { rl, advance } = limiter();
    rl.check("a");
    rl.check("a");
    expect(rl.check("a").ok).toBe(false);
    advance(10_000);
    expect(rl.check("a")).toEqual({ ok: true });
    expect(rl.check("a")).toEqual({ ok: true });
    expect(rl.check("a").ok).toBe(false);
  });

  it("tracks keys independently", () => {
    const { rl } = limiter({ limit: 1 });
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("a").ok).toBe(false);
    expect(rl.check("b").ok).toBe(true);
  });

  it("bounds memory: evicts the oldest bucket when full", () => {
    const { rl } = limiter({ limit: 1, maxKeys: 2 });
    rl.check("a");
    rl.check("b");
    // Full and nothing expired: adding "c" evicts the oldest ("a").
    expect(rl.check("c").ok).toBe(true);
    expect(rl.check("a").ok).toBe(true); // "a" was forgotten, so it is allowed again
    expect(rl.check("c").ok).toBe(false); // "c" is still tracked

  });

  it("clears expired buckets before evicting a live one", () => {
    const { rl, advance } = limiter({ limit: 1, maxKeys: 2 });
    rl.check("a"); // window ends at +10s
    advance(6_000);
    rl.check("b"); // window ends at +16s
    advance(5_000); // a expired (11s), b live
    rl.check("a"); // a starts a new window in place, so it is still the oldest key
    advance(6_000); // now b is expired (17s > 16s) but a is live (21s)
    // Full: "c" must drop expired "b", not the older but live "a".
    expect(rl.check("c").ok).toBe(true);
    expect(rl.check("a").ok).toBe(false);
  });
});

describe("getClientId", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/x", { headers });

  it("uses the first x-forwarded-for address", () => {
    expect(getClientId(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(getClientId(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(getClientId(req({}))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** Loads a fresh module so the env-configured limits and counters are new. */
  async function load(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    return (await import("@/lib/llm/rate-limit")).checkRateLimit;
  }
  const from = (ip: string) =>
    new Request("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

  it("returns null under the limit and a 429 with Retry-After over it", async () => {
    const checkRateLimit = await load({ RATE_LIMIT_MAX: "2" });
    expect((await checkRateLimit(from("1.1.1.1")))).toBeNull();
    expect((await checkRateLimit(from("1.1.1.1")))).toBeNull();

    const blocked = (await checkRateLimit(from("1.1.1.1")))!;
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/too many requests/i);
  });

  it("counts a refused request, and only a refused one", async () => {
    countFloodEvent.mockClear();
    const checkRateLimit = await load({ RATE_LIMIT_MAX: "1" });
    await checkRateLimit(from("3.3.3.3"));
    expect(countFloodEvent).not.toHaveBeenCalled();
    await checkRateLimit(from("3.3.3.3"));
    expect(countFloodEvent).toHaveBeenCalledWith("rate_limited");
  });

  it("limits each client separately", async () => {
    const checkRateLimit = await load({ RATE_LIMIT_MAX: "1" });
    expect((await checkRateLimit(from("1.1.1.1")))).toBeNull();
    expect((await checkRateLimit(from("1.1.1.1")))?.status).toBe(429);
    expect((await checkRateLimit(from("2.2.2.2")))).toBeNull();
  });

  it("enforces a global cap across clients", async () => {
    const checkRateLimit = await load({ RATE_LIMIT_GLOBAL_MAX: "2" });
    expect((await checkRateLimit(from("1.1.1.1")))).toBeNull();
    expect((await checkRateLimit(from("2.2.2.2")))).toBeNull();
    expect((await checkRateLimit(from("3.3.3.3")))?.status).toBe(429);
  });

  it("does not spend the global budget on requests already blocked per client", async () => {
    const checkRateLimit = await load({
      RATE_LIMIT_MAX: "1",
      RATE_LIMIT_GLOBAL_MAX: "2",
    });
    expect((await checkRateLimit(from("1.1.1.1")))).toBeNull(); // global 1/2
    for (let i = 0; i < 5; i++) (await checkRateLimit(from("1.1.1.1"))); // blocked per client
    expect((await checkRateLimit(from("2.2.2.2")))).toBeNull(); // global 2/2, still fine
  });

  it.each(["abc", "0", "-5", ""])(
    "ignores invalid env value %j and uses the default of 20",
    async (value) => {
      const checkRateLimit = await load({ RATE_LIMIT_MAX: value });
      for (let i = 0; i < 20; i++) expect((await checkRateLimit(from("1.1.1.1")))).toBeNull();
      expect((await checkRateLimit(from("1.1.1.1")))?.status).toBe(429);
    },
  );
});
