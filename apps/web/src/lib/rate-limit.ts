import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let baseRateLimit: Ratelimit | null = null;

try {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (url && token) {
		const redis = new Redis({ url, token });
		baseRateLimit = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(100, "1 m"),
			analytics: true,
			prefix: "rate-limit",
		});
	}
} catch {}

export async function checkRateLimit({ request }: { request: Request }) {
	if (!baseRateLimit) {
		return { success: true, limited: false };
	}
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = await baseRateLimit.limit(ip);
	return { success, limited: !success };
}

export { baseRateLimit };
