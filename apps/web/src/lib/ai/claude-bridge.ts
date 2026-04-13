import { spawn } from "child_process";

export interface ClaudeResult {
	result: string;
	structured_output?: {
		message: string;
		actions: Array<{ tool: string; params: Record<string, unknown> }>;
	};
	session_id: string;
}

function spawnClaudeCli(
	args: string[],
	stdin: string,
	timeout: number,
): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const proc = spawn("claude", args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				HOME: process.env.HOME || "/root",
				NODE_ENV: process.env.NODE_ENV || "production",
			},
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGKILL");
			reject(new Error(`Claude CLI timed out after ${timeout / 1000}s. stderr: ${stderr.slice(0, 200)}`));
		}, timeout);

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		proc.on("error", (err: Error) => {
			clearTimeout(timer);
			reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
		});

		proc.on("close", (code: number | null) => {
			clearTimeout(timer);
			if (timedOut) return;

			if (!stdout.trim()) {
				reject(new Error(`Claude CLI returned empty output (code ${code}). stderr: ${stderr.slice(0, 500)}`));
				return;
			}

			try {
				resolve(JSON.parse(stdout));
			} catch {
				reject(new Error(`Failed to parse CLI output (code ${code}): ${stdout.slice(0, 300)}`));
			}
		});

		proc.stdin.write(stdin);
		proc.stdin.end();
	});
}

export async function spawnClaude(
	systemPrompt: string,
	userMessage: string,
	schemaJson: string,
	_sessionId?: string,
): Promise<ClaudeResult> {
	const result = await spawnClaudeCli(
		[
			"-p",
			"--output-format", "json",
			"--max-turns", "2",
			"--model", "sonnet",
			"--tools", "",
			"--no-session-persistence",
			"--system-prompt", systemPrompt,
			"--json-schema", schemaJson,
		],
		userMessage,
		160000,
	);

	const parsed = result as any;

	return {
		result: parsed.result || "",
		structured_output: parsed.structured_output || undefined,
		session_id: parsed.session_id || "",
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

const REFINE_SCHEMA = JSON.stringify({
	type: "object",
	properties: {
		score: { type: "number" },
		improved_code: { type: "string" },
		explanation: { type: "string" },
	},
	required: ["score", "improved_code", "explanation"],
});

export async function spawnClaudeRefine(
	userMessage: string,
): Promise<RefineResult | null> {
	try {
		const result = await spawnClaudeCli(
			[
				"-p",
				"--output-format", "json",
				"--max-turns", "2",
				"--model", "haiku",
				"--tools", "",
				"--no-session-persistence",
				"--system-prompt", REFINE_SYSTEM,
				"--json-schema", REFINE_SCHEMA,
			],
			userMessage,
			45000,
		);

		const parsed = result as any;
		if (parsed.structured_output) {
			return parsed.structured_output as RefineResult;
		}
		return null;
	} catch {
		return null;
	}
}
