import { spawn } from "child_process";

interface ClaudeCliResult {
	result: string;
	structured_output?: {
		message: string;
		actions: Array<{ tool: string; params: Record<string, unknown> }>;
	};
	session_id: string;
	total_cost_usd?: number;
}

export async function spawnClaude(
	systemPrompt: string,
	userMessage: string,
	schemaJson: string,
	sessionId?: string,
): Promise<ClaudeCliResult> {
	return new Promise((resolve, reject) => {
		const args = [
			"-p",
			"--output-format",
			"json",
			"--max-turns",
			"2",
			"--model",
			"sonnet",
			"--tools",
			"",
			"--system-prompt",
			systemPrompt,
			"--json-schema",
			schemaJson,
		];

		if (sessionId) {
			args.push("--resume", sessionId);
		}

		const proc = spawn("claude", args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				PATH: process.env.PATH || "",
				HOME: process.env.HOME || "",
				USER: process.env.USER || "",
				SHELL: process.env.SHELL || "",
				TERM: process.env.TERM || "",
				NODE_ENV: process.env.NODE_ENV || "",
				LANG: process.env.LANG || "",
				XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "",
				ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
				CLAUDE_CODE_OAUTH_TOKEN:
					process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
			},
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill();
			reject(new Error("Claude CLI timed out after 160 seconds"));
		}, 160000);

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
			if (code !== 0 && code !== null) {
				reject(
					new Error(
						`Claude CLI exited with code ${code}: ${stderr}`,
					),
				);
				return;
			}
			try {
				const parsed = JSON.parse(stdout) as ClaudeCliResult;
				resolve(parsed);
			} catch {
				reject(
					new Error(
						`Failed to parse Claude CLI output: ${stdout.slice(0, 500)}`,
					),
				);
			}
		});

		proc.stdin.write(userMessage);
		proc.stdin.end();
	});
}

const REFINE_SCHEMA = JSON.stringify({
	type: "object",
	properties: {
		score: {
			type: "number",
			description: "Quality score 1-10 for the canvas code",
		},
		improved_code: {
			type: "string",
			description:
				"The improved Canvas 2D drawing code. Must use ctx methods only.",
		},
		explanation: {
			type: "string",
			description: "What was improved and why",
		},
	},
	required: ["score", "improved_code", "explanation"],
});

export interface RefineResult {
	score: number;
	improved_code: string;
	explanation: string;
}

export async function spawnClaudeRefine(
	userMessage: string,
): Promise<RefineResult | null> {
	return new Promise((resolve) => {
		const systemPrompt = `You are a Canvas 2D code quality expert. You review and improve HTML5 Canvas 2D drawing code to make it more visually appealing, detailed, and creative.

Rules:
- Code uses ctx (CanvasRenderingContext2D), width, height variables
- Use ONLY Canvas 2D API: fillRect, arc, ellipse, bezierCurveTo, quadraticCurveTo, createLinearGradient, createRadialGradient, etc.
- NO JSX, NO React, NO DOM access, NO fetch, NO eval, NO import
- For characters/creatures: use smooth curves (bezierCurveTo), add eyes with pupils and highlights, mouth/smile, rounded body shapes, small arms/legs, subtle shadows
- For backgrounds: use gradients, multiple layers, subtle textures
- For shapes: precise geometry, anti-aliased edges, shadows/glow effects
- Keep code under 3000 chars
- Always produce complete, runnable code (not fragments)`;

		const args = [
			"-p",
			"--output-format",
			"json",
			"--max-turns",
			"2",
			"--model",
			"sonnet",
			"--tools",
			"",
			"--system-prompt",
			systemPrompt,
			"--json-schema",
			REFINE_SCHEMA,
		];

		const proc = spawn("claude", args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				PATH: process.env.PATH || "",
				HOME: process.env.HOME || "",
				USER: process.env.USER || "",
				SHELL: process.env.SHELL || "",
				TERM: process.env.TERM || "",
				NODE_ENV: process.env.NODE_ENV || "",
				LANG: process.env.LANG || "",
				XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "",
				ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
				CLAUDE_CODE_OAUTH_TOKEN:
					process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
			},
		});

		let stdout = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill();
			resolve(null);
		}, 60000);

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.stderr.on("data", () => {});

		proc.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});

		proc.on("close", () => {
			clearTimeout(timer);
			if (timedOut) return;
			try {
				const parsed = JSON.parse(stdout);
				if (parsed.structured_output) {
					resolve(parsed.structured_output as RefineResult);
				} else {
					resolve(null);
				}
			} catch {
				resolve(null);
			}
		});

		proc.stdin.write(userMessage);
		proc.stdin.end();
	});
}
