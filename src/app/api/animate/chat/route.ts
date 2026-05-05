import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import {
	ANIMATION_TEMPLATES,
	type AnimationSpec,
	type AnimationTemplateId,
} from "@/lib/animate/spec";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Animate-tab chat. The model picks one of our six templates and
 * fills in props based on the user's prompt. We never let the model
 * write Remotion code itself — that surface is curated server-side
 * because:
 *   1) AI-generated JSX has to be sandboxed before it touches the
 *      bundler; not worth the complexity for v1.
 *   2) The template set covers the 80% (titles, lower thirds, big
 *      numbers, quotes, bullets, logos) and is composable later.
 *
 * Output contract: the model returns a fenced JSON block matching
 * AnimationSpec, with `templateId` from our enum and `props` that
 * fit that template. Free-form prose around the JSON is forwarded to
 * the user as a chat message.
 */
const SYSTEM_PROMPT = `You are an animation assistant inside VibeEdit, a video editor. The user describes a short motion graphic they want; you respond with a short message AND a JSON spec the editor can render.

You may ONLY use one of these template ids:
${Object.values(ANIMATION_TEMPLATES)
	.map((t) => `  - "${t.id}" — ${t.blurb}`)
	.join("\n")}

Each template's allowed props:
- "kinetic-title": { text: string, subtitle?: string, color: hex, background: hex, accent: hex }
- "lower-third":   { name: string, role?: string, background: hex|"transparent", accent: hex, textColor: hex }
- "big-number":    { value: number, prefix?: string, suffix?: string, label?: string, color: hex, background: hex, accent: hex }
- "quote-card":    { quote: string, author?: string, background: hex, textColor: hex, accent: hex }
- "bullet-list":   { title?: string, bullets: string[] (3–5 items), background: hex, textColor: hex, accent: hex }
- "logo-reveal":   { imageUrl: string (may be empty for placeholder), background: hex, accent: hex }

Output format — respond with ONE message that includes both:
1. A 1–2 sentence reply to the user explaining what you generated.
2. A JSON code block (\`\`\`json … \`\`\`) containing exactly:
{
  "templateId": "<one of the ids above>",
  "durationFrames": <integer, recommend 60–180>,
  "props": { … },
  "name": "<short label>"
}

Rules:
- Stay within the user's project canvas: use the fps/width/height passed to you for derived hints, but don't include them in your JSON (the server fills those).
- Choose colors that read well on the background (high contrast).
- For "big-number", pick a sensible accent + label.
- If the user asks for something we can't do (3D, video, complex transitions), pick the closest template and say so briefly.
- Never invent template ids. Never write code.`;

interface ChatBody {
	prompt?: string;
	history?: Array<{ role: "user" | "assistant"; content: string }>;
	canvas?: { fps?: number; width?: number; height?: number };
}

export async function POST(request: NextRequest) {
	let body: ChatBody;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "expected JSON body" }, { status: 400 });
	}

	const prompt = (body.prompt ?? "").trim();
	if (!prompt) {
		return Response.json({ error: "prompt is required" }, { status: 400 });
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		return Response.json(
			{
				error:
					"ANTHROPIC_API_KEY missing on server — set it in .env.local to enable Animate chat.",
			},
			{ status: 500 },
		);
	}

	const canvas = {
		fps: body.canvas?.fps ?? 30,
		width: body.canvas?.width ?? 1080,
		height: body.canvas?.height ?? 1920,
	};

	const client = new Anthropic({ apiKey });

	const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
	for (const turn of body.history ?? []) {
		if (turn.role === "user" || turn.role === "assistant") {
			messages.push({ role: turn.role, content: turn.content });
		}
	}
	messages.push({
		role: "user",
		content: `Project canvas: ${canvas.width}×${canvas.height} @ ${canvas.fps}fps.

User prompt: ${prompt}`,
	});

	// SSE stream: emit `text` events as the model produces tokens, then a
	// final `done` event with the parsed spec + cleaned message. Client
	// consumes via fetch + ReadableStream reader.
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (event: object) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};
			let raw = "";
			try {
				const upstream = client.messages.stream({
					model: "claude-sonnet-4-5",
					max_tokens: 1024,
					system: SYSTEM_PROMPT,
					messages,
				});
				upstream.on("text", (delta) => {
					raw += delta;
					send({ type: "text", delta });
				});
				const final = await upstream.finalMessage();
				const spec = extractSpec(raw, canvas);
				// Sonnet 4.5 pricing as of 2026-01: $3/Mtok input, $15/Mtok
				// output. Surface tokens + USD estimate so the client can
				// render a cost meter under the assistant bubble.
				const inputTok = final.usage?.input_tokens ?? 0;
				const outputTok = final.usage?.output_tokens ?? 0;
				const usd =
					inputTok * (3 / 1_000_000) + outputTok * (15 / 1_000_000);
				send({
					type: "done",
					message: stripJsonBlock(raw),
					raw,
					spec,
					usage: {
						inputTokens: inputTok,
						outputTokens: outputTok,
						usd: Number(usd.toFixed(4)),
					},
				});
			} catch (err) {
				const detail = err instanceof Error ? err.message : String(err);
				send({ type: "error", error: `claude failed: ${detail}` });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}

function extractSpec(
	raw: string,
	canvas: { fps: number; width: number; height: number },
): AnimationSpec | null {
	const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
	const jsonStr = fence ? fence[1].trim() : tryFindBareJson(raw);
	if (!jsonStr) return null;
	try {
		const parsed = JSON.parse(jsonStr) as {
			templateId?: string;
			durationFrames?: number;
			props?: Record<string, unknown>;
			name?: string;
		};
		if (!parsed.templateId || !(parsed.templateId in ANIMATION_TEMPLATES)) {
			return null;
		}
		const tplId = parsed.templateId as AnimationTemplateId;
		const dur = Number.isFinite(parsed.durationFrames)
			? Math.max(15, Math.min(600, Math.round(parsed.durationFrames as number)))
			: Math.round(ANIMATION_TEMPLATES[tplId].defaultDurationSec * canvas.fps);
		return {
			id: `anim_${Math.random().toString(36).slice(2, 10)}`,
			templateId: tplId,
			durationFrames: dur,
			fps: canvas.fps,
			width: canvas.width,
			height: canvas.height,
			props: { ...ANIMATION_TEMPLATES[tplId].defaultProps, ...(parsed.props ?? {}) },
			name: parsed.name?.toString() ?? ANIMATION_TEMPLATES[tplId].label,
			createdAt: Date.now(),
		};
	} catch {
		return null;
	}
}

function tryFindBareJson(raw: string): string | null {
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	return raw.slice(start, end + 1);
}

function stripJsonBlock(raw: string): string {
	return raw.replace(/```(?:json)?\s*[\s\S]*?```/gi, "").trim();
}
