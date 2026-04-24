import type { NextRequest } from "next/server";
import type { Scene } from "@/lib/scene-schema";
import { createId } from "@/lib/scene-schema";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

interface GenerateRequest {
  script: string;
  characters: string[];
  sfx: string[];
  orientation?: "landscape" | "portrait";
  extendedThinking?: boolean;
}

const SYSTEM_PROMPT_LANDSCAPE = `You are a scene planner for Isaac/Odd1sOut-style faceless animated short-form videos on a 1920x1080 (16:9 landscape) canvas.

Input: a script, one idea per line. Output: a JSON array of scenes via the emit_scenes tool.

Scene types:
- "character_text": character image + text overlay. Main narrative beat.
- "text_only": large emphasis text, no character. Use for ALL CAPS / punchy lines.
- "big_number": animated counter (numberFrom → numberTo). Use when a line is a bare number (e.g. "10K", "1M").
- "character_pop": character bursts in with short caption. Use for punctuation/reaction beats.

Pacing:
- duration 1.5-3.5s per scene (shorter = punchier).
- Alternate character positions so the video doesn't feel static: characterX 450 (left), 960 (center), 1350 (right); characterY around 850-950.
- textY around 250-400 (text sits above the character).
- enterFrom cycles "left" / "right" / "bottom" / "scale" for variety.
- Add SFX on most scenes. Cycle through available SFX ids.
- transition: "beat_flash" most scenes, "none" for calm beats, "beat_flash_colored" + transitionColor for big_number hits.
- zoomPunch 1.1-1.2 on emphasis beats (every 2-3 scenes); 0 otherwise.
- shakeIntensity 6-10 sparingly for high-energy moments.

Colors: emphasisColor should cycle bright accents (#ef4444, #f59e0b, #10b981, #38bdf8, #818cf8, #a78bfa, #fb923c, #ec4899). textColor should stay muted (#aaaaaa, #999999). background.color in #0a0a0a-#111118; vignette 0.4-0.5.

Return one scene per meaningful line. Keep id empty — it will be filled in.`;

const SYSTEM_PROMPT_PORTRAIT = `You are a scene planner for Isaac/Odd1sOut-style faceless animated short-form videos on a 1080x1920 (9:16 portrait — TikTok/Shorts/Reels) canvas.

Input: a script, one idea per line. Output: a JSON array of scenes via the emit_scenes tool.

Scene types:
- "character_text": character image + text overlay. Main narrative beat.
- "text_only": large emphasis text, no character. Use for ALL CAPS / punchy lines.
- "big_number": animated counter. Use when a line is a bare number (e.g. "10K", "1M").
- "character_pop": character bursts in with short caption.

Pacing — portrait layout:
- duration 1.5-3.5s per scene.
- characterX: center the character around 540 (canvas center). Keep characterX between 300 and 780 so the character stays fully visible. Use 540 most of the time, with small side variation for motion.
- characterY: 1400-1650 — character sits in the lower-middle of the tall frame.
- characterScale: 1.4-1.9 (bigger than landscape because the frame is narrower).
- textY: 400-900 — text sits in the upper-middle, well above the character.
- emphasisSize should be larger (80-140) since the frame is narrower; keep lines short so they don't wrap.
- enterFrom cycles "left" / "right" / "bottom" / "scale".
- SFX on most scenes. transition "beat_flash" most scenes, "beat_flash_colored" on big_number.
- zoomPunch 1.1-1.2 on emphasis beats, 0 otherwise. shakeIntensity 6-10 sparingly.

Colors: emphasisColor cycles bright accents (#ef4444, #f59e0b, #10b981, #38bdf8, #818cf8, #a78bfa, #fb923c, #ec4899). textColor muted (#aaaaaa, #999999). background.color in #0a0a0a-#111118; vignette 0.4-0.5.

Return one scene per meaningful line. Keep id empty — it will be filled in.`;

const TOOL_SCHEMA = {
  name: "emit_scenes",
  description: "Emit the full ordered list of scenes for the video.",
  input_schema: {
    type: "object",
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["character_text", "text_only", "big_number", "character_pop"],
            },
            duration: { type: "number" },
            characterId: { type: "string" },
            characterX: { type: "number" },
            characterY: { type: "number" },
            characterScale: { type: "number" },
            enterFrom: { type: "string", enum: ["left", "right", "bottom", "scale"] },
            flipCharacter: { type: "boolean" },
            text: { type: "string" },
            textColor: { type: "string" },
            textY: { type: "number" },
            emphasisText: { type: "string" },
            emphasisSize: { type: "number" },
            emphasisColor: { type: "string" },
            emphasisGlow: { type: "string" },
            numberFrom: { type: "number" },
            numberTo: { type: "number" },
            numberSuffix: { type: "string" },
            numberColor: { type: "string" },
            sfxId: { type: "string" },
            transition: { type: "string", enum: ["beat_flash", "beat_flash_colored", "none"] },
            transitionColor: { type: "string" },
            shakeIntensity: { type: "number" },
            zoomPunch: { type: "number" },
            background: {
              type: "object",
              properties: {
                color: { type: "string" },
                graphic: { type: "string" },
                graphicY: { type: "number" },
                graphicOpacity: { type: "number" },
                vignette: { type: "number" },
              },
              required: ["color"],
            },
          },
          required: ["type", "duration", "background"],
        },
      },
    },
    required: ["scenes"],
  },
};

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function finalizeScene(raw: unknown): Scene {
  const s = raw as Partial<Scene>;
  return {
    id: createId(),
    ...s,
    background: s.background ?? { color: "#0a0a0a", vignette: 0.5 },
  } as Scene;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateRequest;
  if (!body.script?.trim()) {
    return Response.json({ error: "script required" }, { status: 400 });
  }

  const charList = body.characters.join(", ") || "(none)";
  const sfxList = body.sfx.join(", ") || "(none)";
  const systemPrompt =
    body.orientation === "portrait" ? SYSTEM_PROMPT_PORTRAIT : SYSTEM_PROMPT_LANDSCAPE;

  const thinkingEnabled = !!body.extendedThinking;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseLine(data)));
        } catch {
          // already closed
        }
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        const data = await callClaude(
          {
            model: "claude-sonnet-4-5",
            max_tokens: thinkingEnabled ? 16384 : 8192,
            ...(thinkingEnabled
              ? {
                  thinking: { type: "enabled", budget_tokens: 4096 },
                  temperature: 1,
                }
              : {}),
            system: [
              { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: thinkingEnabled
              ? { type: "any" }
              : { type: "tool", name: "emit_scenes" },
            messages: [
              {
                role: "user",
                content: `Available character ids: [${charList}]\nAvailable SFX ids: [${sfxList}]\n\nScript:\n${body.script}`,
              },
            ],
          },
          "generate",
        );
        const toolUse = data.content?.find((c) => c.type === "tool_use");
        const scenes =
          (toolUse?.input?.scenes as Array<Record<string, unknown>> | undefined) ?? [];
        for (const raw of scenes) {
          send({ type: "scene", scene: finalizeScene(raw) });
          // Tiny delay preserves the "scenes stream in" feel when the bridge
          // hands us the full result at once.
          await new Promise((r) => setTimeout(r, 30));
        }
        send({ type: "done", count: scenes.length });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
