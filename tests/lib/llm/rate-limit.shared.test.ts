import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getVerifiedUser } = vi.hoisted(() => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ getVerifiedUser }));

/** A tiny in-memory Upstash: understands the pipeline of INCR / PEXPIRE / PTTL. */
function fakeUpstash() {
  const counts = new Map<string, number>();
  const calls: string[][] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const commands = JSON.parse(init.body as string) as (string | number)[][];
    calls.push(commands.map((c) => String(c[1])));
    const out = commands.map(([name, key]) => {
      if (name === "INCR") {
        counts.set(String(key), (counts.get(String(key)) ?? 0) + 1);
        return { result: counts.get(String(key)) };
      }
      if (name === "PEXPIRE") return { result: 0 };
      return { result: 30_000 }; // PTTL
    });
    return new Response(JSON.stringify(out), { status: 200 });
  });
  return { fetchMock, counts, calls };
}

async function load(env: Record<string, string>) {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return (await import("@/lib/llm/rate-limit")).checkRateLimit;
}

const from = (ip: string) =>
  new Request("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  getVerifiedUser.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("checkRateLimit with Redis", () => {
  it("counts in Redis, blocks over the limit and reports Retry-After from the window", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchMock);
    const check = await load({ RATE_LIMIT_MAX: "2" });

    expect(await check(from("1.1.1.1"))).toBeNull();
    expect(await check(from("1.1.1.1"))).toBeNull();
    const blocked = await check(from("1.1.1.1"));
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("30");
  });

  it("never puts the raw address in a key, only a salted hash", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchMock);
    const check = await load({ RATE_LIMIT_SALT: "s3cret" });
    await check(from("203.0.113.7"));
    const keys = [...redis.counts.keys()];
    expect(keys.some((k) => k.startsWith("kapi:rl:client:i:"))).toBe(true);
    expect(keys.join(" ")).not.toContain("203.0.113.7");

    const other = await load({ RATE_LIMIT_SALT: "different" });
    const redis2 = fakeUpstash();
    vi.stubGlobal("fetch", redis2.fetchMock);
    await other(from("203.0.113.7"));
    expect([...redis2.counts.keys()][0]).not.toBe(keys[0]);
  });

  it("limits a signed-in learner by account, whatever address they come from", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchMock);
    getVerifiedUser.mockResolvedValue({ id: "user-1" });
    const check = await load({ RATE_LIMIT_MAX: "1" });

    expect(await check(from("1.1.1.1"))).toBeNull();
    expect((await check(from("2.2.2.2")))?.status).toBe(429);
    expect(redis.counts.has("kapi:rl:client:u:user-1")).toBe(true);
  });

  it("does not spend the global budget on a request already blocked per client", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchMock);
    const check = await load({ RATE_LIMIT_MAX: "1" });
    await check(from("1.1.1.1")); // client + global
    redis.fetchMock.mockClear();
    await check(from("1.1.1.1")); // blocked per client: one Redis call, no global
    expect(redis.fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.counts.get("kapi:rl:global:all")).toBe(1);
  });

  it("falls back to in-memory limits when Redis fails, instead of blocking learners", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const check = await load({ RATE_LIMIT_MAX: "2" });

    expect(await check(from("1.1.1.1"))).toBeNull();
    expect(await check(from("1.1.1.1"))).toBeNull();
    expect((await check(from("1.1.1.1")))?.status).toBe(429); // memory limit still applies
    expect(console.warn).toHaveBeenCalledTimes(1); // warned once, not per request
  });

  it("uses only memory when Redis isn't configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("RATE_LIMIT_MAX", "1");
    vi.resetModules();
    const check = (await import("@/lib/llm/rate-limit")).checkRateLimit;
    expect(await check(from("1.1.1.1"))).toBeNull();
    expect((await check(from("1.1.1.1")))?.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
