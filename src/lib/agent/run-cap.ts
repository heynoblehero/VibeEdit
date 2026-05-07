/**
 * Daily run cap for the AI agent — per IP, in-memory.
 *
 * v1 user-locked decision: 3 full critic-loop runs per day per user.
 * Authentication isn't plumbed through every route uniformly, so for
 * now we key on the request IP — crude but effective at blocking
 * runaway loops. When auth lands across the agent surface, swap the
 * key to userId.
 *
 * "Skip-critique" runs (single emit, no Critic) cost ~$0.05 each and
 * don't count against the cap. Only full loops (with the 3× render
 * + 3× vision rounds at ~$0.65 each) get gated.
 */

const MAX_RUNS_PER_DAY = 3;

interface Bucket {
	/** Run count today. */
	count: number;
	/** Day start in epoch ms (UTC midnight); used to roll over. */
	dayStart: number;
}

const buckets = new Map<string, Bucket>();

function dayStartUtc(now: number): number {
	const d = new Date(now);
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
}

function getOrFresh(key: string, now: number): Bucket {
	const today = dayStartUtc(now);
	const existing = buckets.get(key);
	if (!existing || existing.dayStart !== today) {
		const fresh: Bucket = { count: 0, dayStart: today };
		buckets.set(key, fresh);
		return fresh;
	}
	return existing;
}

/**
 * Try to charge one critic-loop run against `key`. Returns ok=true if
 * the run is allowed; ok=false with a reason when the cap is reached.
 */
export function tryCharge(key: string, now: number = Date.now()): {
	ok: boolean;
	remaining: number;
	limit: number;
} {
	const bucket = getOrFresh(key, now);
	if (bucket.count >= MAX_RUNS_PER_DAY) {
		return { ok: false, remaining: 0, limit: MAX_RUNS_PER_DAY };
	}
	bucket.count += 1;
	return {
		ok: true,
		remaining: MAX_RUNS_PER_DAY - bucket.count,
		limit: MAX_RUNS_PER_DAY,
	};
}

export function peekRemaining(key: string, now: number = Date.now()): number {
	const bucket = getOrFresh(key, now);
	return Math.max(0, MAX_RUNS_PER_DAY - bucket.count);
}
