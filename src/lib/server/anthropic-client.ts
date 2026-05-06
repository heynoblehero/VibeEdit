import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client built from `ANTHROPIC_API_KEY`.
 * Throws a clean error (caught by the agent runner and surfaced over
 * SSE) when the key is missing — better than a 500 with a stack
 * trace the user can't act on.
 */
export function getAnthropic(): Anthropic {
	if (cached) return cached;
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY is missing. Set it in .env.local (server-side only).",
		);
	}
	cached = new Anthropic({ apiKey });
	return cached;
}

/** Default model for Creator + Critic stages. Sonnet is the cost/quality
 *  sweet spot; Opus only when the loop genuinely needs it. */
export const AGENT_MODEL = "claude-sonnet-4-6";
