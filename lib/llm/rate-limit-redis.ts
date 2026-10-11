import type { RateLimitResult } from "./rate-limit";

const REQUEST_TIMEOUT_MS = 1_500;

type PipelineItem = { result?: unknown; error?: string };

/**
 * Fixed-window counters in Upstash Redis, reached over its REST API (plain
 * fetch, no SDK). One request per check: INCR, then PEXPIRE ... NX so the
 * window starts at the first hit and is never extended, then PTTL for the time
 * left. State is shared by every serverless instance. Throws on any failure;
 * the caller decides what to do (it falls back to the in-memory limiter).
 */
export function createRedisCounter({
  url,
  token,
}: {
  url: string;
  token: string;
}) {
  async function run(commands: (string | number)[][]): Promise<PipelineItem[]> {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Redis returned ${response.status}`);
    const items = (await response.json()) as PipelineItem[];
    const failed = items.find((item) => item.error);
    if (failed) throw new Error(`Redis error: ${failed.error}`);
    return items;
  }

  return {
    async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
      const [count, , ttl] = (
        await run([
          ["INCR", key],
          ["PEXPIRE", key, windowMs, "NX"],
          ["PTTL", key],
        ])
      ).map((item) => Number(item.result));

      let remainingMs = ttl;
      if (!(ttl > 0)) {
        // The key has no expiry (the expire call was lost): set one now so it
        // can never block a caller forever.
        await run([["PEXPIRE", key, windowMs]]);
        remainingMs = windowMs;
      }
      return count > limit ? { ok: false, retryAfterMs: remainingMs } : { ok: true };
    },
  };
}
