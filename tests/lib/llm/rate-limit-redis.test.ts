import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRedisCounter } from "@/lib/llm/rate-limit-redis";

const counter = () => createRedisCounter({ url: "https://example.upstash.io/", token: "tok" });

function pipelineReply(...results: unknown[]) {
  return new Response(JSON.stringify(results.map((result) => ({ result }))), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("createRedisCounter", () => {
  it("counts a hit with one pipelined request: INCR, PEXPIRE NX, PTTL", async () => {
    fetchMock.mockResolvedValue(pipelineReply(1, 1, 599_000));
    expect(await counter().hit("k", 3, 600_000)).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual([
      ["INCR", "k"],
      ["PEXPIRE", "k", 600_000, "NX"],
      ["PTTL", "k"],
    ]);
  });

  it("allows up to the limit and blocks after it, with the time left in the window", async () => {
    fetchMock.mockResolvedValueOnce(pipelineReply(3, 0, 42_000));
    expect(await counter().hit("k", 3, 600_000)).toEqual({ ok: true });
    fetchMock.mockResolvedValueOnce(pipelineReply(4, 0, 41_000));
    expect(await counter().hit("k", 3, 600_000)).toEqual({ ok: false, retryAfterMs: 41_000 });
  });

  it("gives a key that lost its expiry a fresh one so it cannot block forever", async () => {
    fetchMock
      .mockResolvedValueOnce(pipelineReply(9, 0, -1))
      .mockResolvedValueOnce(pipelineReply(1));
    expect(await counter().hit("k", 3, 600_000)).toEqual({ ok: false, retryAfterMs: 600_000 });
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)).toEqual([
      ["PEXPIRE", "k", 600_000],
    ]);
  });

  it("throws on an HTTP error, a Redis error or a network failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(counter().hit("k", 1, 1000)).rejects.toThrow("401");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ error: "ERR wrong" }]), { status: 200 }),
    );
    await expect(counter().hit("k", 1, 1000)).rejects.toThrow("ERR wrong");

    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    await expect(counter().hit("k", 1, 1000)).rejects.toThrow("network down");
  });
});
