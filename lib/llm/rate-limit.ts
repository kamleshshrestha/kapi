import { createHmac } from "node:crypto";
import { getVerifiedUser } from "@/lib/supabase/user";
import { createRedisCounter } from "./rate-limit-redis";

type Bucket = { count: number; resetAt: number };

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

/**
 * Fixed-window counter per key, held in memory. State is per server instance
 * (it resets on restart and is not shared across serverless instances), so it
 * caps abuse of the API key rather than enforcing exact quotas.
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Bounds memory: on overflow, expired buckets go first, then the oldest. */
  maxKeys?: number;
}) {
  const buckets = new Map<string, Bucket>();

  function makeRoom(time: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= time) buckets.delete(key);
    }
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const time = now();
      let bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= time) {
        if (!bucket && buckets.size >= maxKeys) makeRoom(time);
        bucket = { count: 0, resetAt: time + windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= limit) {
        return { ok: false, retryAfterMs: bucket.resetAt - time };
      }
      bucket.count += 1;
      return { ok: true };
    },
  };
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Identifies the caller by the proxy-provided address. These headers are only
 * trustworthy behind a proxy that overwrites them; otherwise a caller can
 * spoof them, which is why a global cap backs up the per-client one.
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

// A full learning session makes 3 LLM calls, so the defaults allow about 6
// sessions per client every 10 minutes. Override with the env vars below.
const clientLimit = numberFromEnv("RATE_LIMIT_MAX", 20);
const clientWindowMs = numberFromEnv("RATE_LIMIT_WINDOW_SECONDS", 600) * 1000;
const globalLimit = numberFromEnv("RATE_LIMIT_GLOBAL_MAX", 500);
const globalWindowMs = numberFromEnv("RATE_LIMIT_GLOBAL_WINDOW_SECONDS", 3600) * 1000;

// In-memory limiters: the only ones when Redis is not configured, and the
// fallback when it can't be reached.
const clientLimiter = createRateLimiter({ limit: clientLimit, windowMs: clientWindowMs });
const globalLimiter = createRateLimiter({ limit: globalLimit, windowMs: globalWindowMs });

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? createRedisCounter({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Raw addresses are personal data, so only a salted hash is used as a key (and
 * so ends up in Redis). Set RATE_LIMIT_SALT to your own secret value.
 */
function hashAddress(address: string): string {
  return createHmac("sha256", process.env.RATE_LIMIT_SALT ?? "kapi-rate-limit")
    .update(address)
    .digest("hex")
    .slice(0, 24);
}

let lastRedisWarning = 0;
function warnRedisDown(error: unknown) {
  const now = Date.now();
  if (now - lastRedisWarning < 60_000) return;
  lastRedisWarning = now;
  console.warn("[rate-limit] Redis unavailable, using in-memory limits:", error);
}

/** Counts one hit in Redis when it is configured and reachable, else in memory. */
async function hit(
  scope: "client" | "global",
  subject: string,
  limit: number,
  windowMs: number,
  memory: ReturnType<typeof createRateLimiter>,
): Promise<RateLimitResult> {
  if (redis) {
    try {
      return await redis.hit(`kapi:rl:${scope}:${subject}`, limit, windowMs);
    } catch (error) {
      warnRedisDown(error);
    }
  }
  return memory.check(subject);
}

/**
 * Call first in an LLM-backed route handler. Returns a 429 response when the
 * caller (or the whole app) is over its limit, otherwise null. A signed-in
 * learner is limited by their account, anyone else by address (hashed), and a
 * global cap backs both up.
 */
export async function checkRateLimit(request: Request): Promise<Response | null> {
  const user = await getVerifiedUser();
  const subject = user ? `u:${user.id}` : `i:${hashAddress(getClientId(request))}`;

  // Per-client first, so one abusive client cannot use up the global budget.
  const result = await hit("client", subject, clientLimit, clientWindowMs, clientLimiter);
  const overall = result.ok
    ? await hit("global", "all", globalLimit, globalWindowMs, globalLimiter)
    : result;
  if (overall.ok) return null;

  const retryAfter = Math.ceil(overall.retryAfterMs / 1000);
  return Response.json(
    { error: `Too many requests. Please try again in ${retryAfter} seconds.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
