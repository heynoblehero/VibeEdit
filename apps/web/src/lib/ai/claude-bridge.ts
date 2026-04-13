import Anthropic from "@anthropic-ai/sdk";

const getClient = (() => {
	let client: Anthropic | null = null;
	return () => {
		if (!client) {
			const apiKey = process.env.ANTHROPIC_API_KEY || "";
			const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN || "";

			if (!apiKey && !oauthToken) {
				throw new Error("No API key or OAuth token configured");
			}

			if (apiKey && !apiKey.startsWith("sk-ant-oat")) {
				// Regular API key — use standard auth
				client = new Anthropic({ apiKey });
			} else {
				// OAuth token — use Bearer auth via header override
				const token = apiKey || oauthToken;
				client = new Anthropic({
					apiKey: "placeholder",
					defaultHeaders: { Authorization: `Bearer ${token}` },
				});
			}
		}
		return client;
	};
})();

export interface ClaudeResult {
	result: string;
	structured_output?: {
		message: string;
		actions: Array<{ tool: string; params: Record<string, unknown> }>;
	};
	session_id: string;
}

export async function spawnClaude(
	systemPrompt: string,
	userMessage: string,
	_schemaJson: string,
	_sessionId?: string,
): Promise<ClaudeResult> {
	const client = getClient();

	const response = await client.messages.create({
		model: "claude-sonnet-4-5-20250514",
		max_tokens: 4096,
		system: systemPrompt,
		messages: [
			{
				role: "user",
				content: `${userMessage}\n\nRespond with a JSON object containing "message" (your text response) and "actions" (array of editor actions). Each action has "tool" (string) and "params" (object). If no actions needed, use an empty array.`,
			},
		],
	});

	const text =
		response.content[0]?.type === "text" ? response.content[0].text : "";

	// Parse the JSON response
	let parsed: { message?: string; actions?: Array<{ tool: string; params: Record<string, unknown> }> } = {};
	try {
		let jsonStr = text;
		const codeBlockMatch = jsonStr.match(
			/```(?:json)?\s*\n?([\s\S]*?)\n?```/,
		);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}
		parsed = JSON.parse(jsonStr);
	} catch {
		// Not valid JSON — treat as plain text
	}

	return {
		result: text,
		structured_output:
			parsed.message || parsed.actions
				? {
						message: parsed.message || text,
						actions: Array.isArray(parsed.actions)
							? parsed.actions.filter(
									(a) =>
										a &&
										typeof a.tool === "string" &&
										typeof a.params === "object" &&
										a.params !== null,
								)
							: [],
					}
				: undefined,
		session_id: "",
	};
}

const REFINE_SYSTEM = `You are a Canvas 2D code quality expert. You review and improve HTML5 Canvas 2D drawing code to make it more visually appealing, detailed, and creative.

Rules:
- Code uses ctx (CanvasRenderingContext2D), width, height variables
- Use ONLY Canvas 2D API: fillRect, arc, ellipse, bezierCurveTo, quadraticCurveTo, createLinearGradient, createRadialGradient, etc.
- NO JSX, NO React, NO DOM access, NO fetch, NO eval, NO import
- For characters/creatures: use smooth curves (bezierCurveTo), add eyes with pupils and highlights, mouth/smile, rounded body shapes, small arms/legs, subtle shadows
- For backgrounds: use gradients, multiple layers, subtle textures
- For shapes: precise geometry, glow effects (shadowBlur + shadowColor), anti-aliased edges
- Keep code under 3000 chars
- Always produce complete, runnable code (not fragments)
- Respond with ONLY a JSON object: {"score": N, "improved_code": "...", "explanation": "..."}`;

export interface RefineResult {
	score: number;
	improved_code: string;
	explanation: string;
}

export async function spawnClaudeRefine(
	userMessage: string,
): Promise<RefineResult | null> {
	try {
		const client = getClient();

		const response = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 4096,
			system: REFINE_SYSTEM,
			messages: [{ role: "user", content: userMessage }],
		});

		const text =
			response.content[0]?.type === "text"
				? response.content[0].text
				: "";

		let jsonStr = text;
		const codeBlockMatch = jsonStr.match(
			/```(?:json)?\s*\n?([\s\S]*?)\n?```/,
		);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);
		if (
			typeof parsed.score === "number" &&
			typeof parsed.improved_code === "string"
		) {
			return parsed as RefineResult;
		}
		return null;
	} catch {
		return null;
	}
}
