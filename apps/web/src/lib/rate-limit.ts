/*
 * In-memory per-user rate limiter.
 *
 * Two layers:
 *   - Concurrent: max 1 in-flight chat per user (the chat route already
 *     enforces this via its RUNNING map, but we double-check here for tools
 *     that don't go through that map).
 *   - Per-minute and per-day request count: prevents the "one user burns a
 *     $5k Anthropic bill overnight" failure mode.
 *
 * Process-local — fine for a single Node instance. Move to Redis if/when we
 * shard. Survives reasonable forced-refreshes; resets on deploy, which is OK
 * because limits are short-window.
 */

const PER_MINUTE_LIMIT = Number(process.env.CHAT_PER_MINUTE || 12);
const PER_DAY_LIMIT = Number(process.env.CHAT_PER_DAY || 400);

type Bucket = {
  // Sliding window of request timestamps (ms). We trim on every check, so
  // the array length is bounded by PER_DAY_LIMIT.
  timestamps: number[];
};

const GLOBAL = globalThis as unknown as {
  __vibeedit_rate?: Map<string, Bucket>;
};
const BUCKETS: Map<string, Bucket> = GLOBAL.__vibeedit_rate ?? new Map();
GLOBAL.__vibeedit_rate = BUCKETS;

export type RateCheck = {
  ok: boolean;
  retryAfterSec?: number;
  reason?: string;
  usedMinute: number;
  usedDay: number;
};

export function checkRateLimit(key: string): RateCheck {
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  const oneDayAgo = now - 24 * 3600 * 1000;
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    BUCKETS.set(key, bucket);
  }
  // Trim to one-day window.
  bucket.timestamps = bucket.timestamps.filter((t) => t > oneDayAgo);
  const lastMinute = bucket.timestamps.filter((t) => t > oneMinAgo).length;
  const lastDay = bucket.timestamps.length;
  if (lastMinute >= PER_MINUTE_LIMIT) {
    const oldest = bucket.timestamps.find((t) => t > oneMinAgo) || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      reason: `Too many requests — limit ${PER_MINUTE_LIMIT}/min. Try again in ${retryAfterSec}s.`,
      usedMinute: lastMinute,
      usedDay: lastDay,
    };
  }
  if (lastDay >= PER_DAY_LIMIT) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 24 * 3600 * 1000 - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      reason: `Daily limit reached (${PER_DAY_LIMIT}/day). Resets in ${Math.round(retryAfterSec / 3600)}h.`,
      usedMinute: lastMinute,
      usedDay: lastDay,
    };
  }
  bucket.timestamps.push(now);
  return { ok: true, usedMinute: lastMinute + 1, usedDay: lastDay + 1 };
}

export function rateLimitHeaders(check: RateCheck): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ratelimit-minute-used": String(check.usedMinute),
    "x-ratelimit-minute-limit": String(PER_MINUTE_LIMIT),
    "x-ratelimit-day-used": String(check.usedDay),
    "x-ratelimit-day-limit": String(PER_DAY_LIMIT),
  };
  if (check.retryAfterSec) headers["retry-after"] = String(check.retryAfterSec);
  return headers;
}

/* ---------------------------------------------------------------------------
 * Generic sliding-window limiter (used by the edge middleware).
 *
 * The functions above are the per-user, in-route layer (e.g. the chat route
 * keys on `chat:<userId>` after auth). This second limiter is the *front-line*
 * layer applied by `src/middleware.ts` before a request ever reaches a route
 * handler — it's keyed by IP (+ a cheap session-token fingerprint when present)
 * and configured per endpoint. Having both is deliberate defense-in-depth:
 *   - middleware layer  → cuts off unauthenticated / pre-route abuse cheaply,
 *                         protecting the Anthropic / Replicate / ElevenLabs
 *                         spend before any expensive work starts.
 *   - in-route layer    → precise per-account ceilings once we know the userId.
 *
 * STATE / SHARED-STORE SEAM
 * -------------------------
 * State lives in a process-local Map on globalThis. This is correct for the
 * current single-container Dokku deploy. NOTE two consequences:
 *   1. It resets on deploy/restart — fine, the windows are short.
 *   2. Next.js middleware runs in its own (edge) runtime, so this Map is
 *      *separate* from the Node-server Map used by checkRateLimit above. That's
 *      intentional: the two layers are independent.
 * To scale horizontally (multiple replicas) replace the Map operations in
 * `slidingWindowCheck` with a shared store. The function is the single seam:
 * swap the read/trim/push of `entry.hits` for an atomic Redis sorted-set
 * (ZADD + ZREMRANGEBYSCORE + ZCARD) or Upstash `@upstash/ratelimit`, keeping
 * the same `{ ok, retryAfterSec, ... }` return shape. Nothing else changes.
 * ------------------------------------------------------------------------- */

export type WindowLimit = {
  /** Max requests allowed within `windowSec`. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
};

export type WindowCheck = {
  ok: boolean;
  retryAfterSec: number;
  used: number;
  limit: number;
};

type WindowEntry = { hits: number[] };

const GLOBAL_WINDOW = globalThis as unknown as {
  __vibeedit_window_rate?: Map<string, WindowEntry>;
};
const WINDOW_BUCKETS: Map<string, WindowEntry> = GLOBAL_WINDOW.__vibeedit_window_rate ?? new Map();
GLOBAL_WINDOW.__vibeedit_window_rate = WINDOW_BUCKETS;

// Opportunistic GC so the Map can't grow unbounded from one-off IPs. Cheap:
// runs at most once per minute and only scans when we're over a soft cap.
let lastSweep = 0;
function sweep(now: number, maxAgeMs: number) {
  if (now - lastSweep < 60_000 || WINDOW_BUCKETS.size < 5_000) return;
  lastSweep = now;
  for (const [key, entry] of WINDOW_BUCKETS) {
    if (entry.hits.length === 0 || entry.hits[entry.hits.length - 1] < now - maxAgeMs) {
      WINDOW_BUCKETS.delete(key);
    }
  }
}

/**
 * Sliding-window counter. `key` should already encode the endpoint group so
 * different endpoints don't share a budget (e.g. `chat:1.2.3.4`).
 *
 * This is THE seam to swap for a shared store (see header comment).
 */
export function slidingWindowCheck(key: string, cfg: WindowLimit): WindowCheck {
  const now = Date.now();
  const windowMs = cfg.windowSec * 1000;
  const cutoff = now - windowMs;
  sweep(now, windowMs);

  let entry = WINDOW_BUCKETS.get(key);
  if (!entry) {
    entry = { hits: [] };
    WINDOW_BUCKETS.set(key, entry);
  }
  // Trim out-of-window hits.
  if (entry.hits.length && entry.hits[0] <= cutoff) {
    entry.hits = entry.hits.filter((t) => t > cutoff);
  }

  if (entry.hits.length >= cfg.limit) {
    const oldest = entry.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfterSec, used: entry.hits.length, limit: cfg.limit };
  }

  entry.hits.push(now);
  return { ok: true, retryAfterSec: 0, used: entry.hits.length, limit: cfg.limit };
}
