import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeResult {
	result: string;
	structured_output?: {
		message: string;
		actions: Array<{ tool: string; params: Record<string, unknown> }>;
	};
	session_id: string;
}

function getClient(): Anthropic {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY is not set. Add it to your .env.local file or Dokku config.",
		);
	}
	return new Anthropic({ apiKey });
}

export async function spawnClaude(
	systemPrompt: string,
	userMessage: string,
	schemaJson: string,
	_sessionId?: string,
): Promise<ClaudeResult> {
	const client = getClient();

	const schema = JSON.parse(schemaJson);

	const response = await client.messages.create({
		model: "claude-sonnet-4-20250514",
		max_tokens: 4096,
		system: systemPrompt,
		messages: [{ role: "user", content: userMessage }],
		tools: [
			{
				name: "editor_response",
				description:
					"Return the structured response with a message and editor actions.",
				input_schema: schema,
			},
		],
		tool_choice: { type: "tool", name: "editor_response" },
	});

	// Extract the tool use block
	const toolBlock = response.content.find((block) => block.type === "tool_use");
	if (toolBlock && toolBlock.type === "tool_use") {
		const input = toolBlock.input as {
			message?: string;
			actions?: Array<{ tool: string; params: Record<string, unknown> }>;
		};
		return {
			result: input.message || "",
			structured_output: {
				message: input.message || "",
				actions: input.actions || [],
			},
			session_id: "",
		};
	}

	// Fallback: extract text from response
	const textBlock = response.content.find((block) => block.type === "text");
	const text =
		textBlock && textBlock.type === "text" ? textBlock.text : "No response";

	return {
		result: text,
		session_id: "",
	};
}

export interface RefineResult {
	score: number;
	improved_code: string;
	explanation: string;
}

const REFINE_SYSTEM = `You are a Canvas 2D code quality expert. You review and improve HTML5 Canvas 2D drawing code to make it more visually appealing, detailed, and creative.

Rules:
- Code uses ctx (CanvasRenderingContext2D), width, height variables
- Use ONLY Canvas 2D API: fillRect, arc, ellipse, bezierCurveTo, quadraticCurveTo, createLinearGradient, createRadialGradient, etc.
- NO JSX, NO React, NO DOM access, NO fetch, NO eval, NO import
- For characters/creatures: use smooth curves, add eyes with pupils and highlights, mouth/smile, rounded body, small arms/legs, subtle shadows
- Keep code under 3000 chars
- Respond with ONLY a JSON object: {"score": N, "improved_code": "...", "explanation": "..."}`;

const REFINE_SCHEMA = {
	type: "object" as const,
	properties: {
		score: { type: "number" as const, description: "Quality score 1-10" },
		improved_code: {
			type: "string" as const,
			description: "Improved Canvas 2D code",
		},
		explanation: {
			type: "string" as const,
			description: "What was improved",
		},
	},
	required: ["score", "improved_code", "explanation"],
};

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
			tools: [
				{
					name: "refine_result",
					description: "Return the refinement result.",
					input_schema: REFINE_SCHEMA,
				},
			],
			tool_choice: { type: "tool", name: "refine_result" },
		});

		const toolBlock = response.content.find(
			(block) => block.type === "tool_use",
		);
		if (toolBlock && toolBlock.type === "tool_use") {
			return toolBlock.input as RefineResult;
		}

		return null;
	} catch {
		return null;
	}
}
