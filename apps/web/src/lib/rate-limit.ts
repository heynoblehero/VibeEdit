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
