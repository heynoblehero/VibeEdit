import type { NextRequest } from "next/server";
import { searchAllSources, type SearchResult } from "@/lib/broll-search";
import type { BRollPosition } from "@/lib/scene-schema";
import { callClaude, isBridgeMode } from "@/lib/server/claude-bridge";

interface SuggestRequest {
  scenes: Array<{ id: string; text: string; durationSec: number }>;
  tone?: string;
}

interface LineAnalysis {
  sceneId: string;
  keywords: string[];
  kindPreference: "clip" | "image" | "gif" | "any";
  position: BRollPosition;
  rationale: string;
}

interface SuggestResponseItem {
  sceneId: string;
  keywords: string[];
  position: BRollPosition;
  kindPreference: string;
  rationale: string;
  clips: SearchResult[];
  images: SearchResult[];
  gifs: SearchResult[];
}

const SYSTEM_PROMPT = `You choose B-roll for a short-form video. You will receive a numbered list of scene lines. For each scene, produce:
- keywords: 2-4 short search terms (single words or 2-word phrases). Visual nouns and actions work best.
- kindPreference: "clip" for motion, "image" for static visuals, "gif" for reactions/memes, "any" if either works.
- position: "full" (full frame) for primary visuals, "overlay-tr"/"overlay-br"/"overlay-tl"/"overlay-bl" (small corner) for reaction beats, "pip-left"/"pip-right" (medium side) for commentary, "lower-third" (banner) for supporting captions.
- rationale: one short phrase — why this fits.

Use the emit_broll_plan tool. Return exactly one entry per scene, in the same order, with the same sceneId.`;

async function analyzeScenesWithClaude(
  scenes: SuggestRequest["scenes"],
  tone?: string,
): Promise<LineAnalysis[]> {
  const user = scenes
    .map((s, i) => `${i + 1}. id=${s.id} (${s.durationSec}s): ${s.text}`)
    .join("\n");
  const toneLine = tone ? `Tone of the video: ${tone}\n\n` : "";

  const data = await callClaude(
    {
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "emit_broll_plan",
          description: "Emit the B-roll plan for every scene, in order.",
          input_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sceneId: { type: "string" },
                    keywords: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                      maxItems: 4,
                    },
                    kindPreference: {
                      type: "string",
                      enum: ["clip", "image", "gif", "any"],
                    },
                    position: {
                      type: "string",
                      enum: [
                        "full",
                        "overlay-tl",
                        "overlay-tr",
                        "overlay-bl",
                        "overlay-br",
                        "pip-left",
                        "pip-right",
                        "lower-third",
                      ],
                    },
                    rationale: { type: "string" },
                  },
                  required: ["sceneId", "keywords", "kindPreference", "position", "rationale"],
                },
              },
            },
            required: ["items"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_broll_plan" },
      messages: [{ role: "user", content: `${toneLine}${user}` }],
    },
    "broll/suggest",
  );
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  return (toolUse?.input?.items ?? []) as LineAnalysis[];
}

function heuristicAnalysis(scenes: SuggestRequest["scenes"]): LineAnalysis[] {
  return scenes.map((s) => {
    const text = s.text.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
    const keywords = words.length ? words : [s.text.slice(0, 30)];
    const isReaction = /wow|lol|omg|crazy|insane|mind.?blown|shock|wtf/.test(text);
    const isNumber = /\d/.test(s.text);
    return {
      sceneId: s.id,
      keywords,
      kindPreference: isReaction ? "gif" : isNumber ? "image" : "clip",
      position: isReaction ? "overlay-tr" : "full",
      rationale: isReaction ? "reaction" : isNumber ? "supporting data" : "literal",
    };
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SuggestRequest;
  if (!body?.scenes?.length) {
    return Response.json({ error: "scenes required" }, { status: 400 });
  }

  let analyses: LineAnalysis[] = [];
  if (process.env.ANTHROPIC_API_KEY || isBridgeMode()) {
    try {
      analyses = await analyzeScenesWithClaude(body.scenes, body.tone);
    } catch (e) {
      console.error("Claude analysis failed, falling back to heuristic:", e);
    }
  }
  if (analyses.length !== body.scenes.length) {
    analyses = heuristicAnalysis(body.scenes);
  }

  const results = await Promise.all(
    analyses.map(async (a) => {
      const query = a.keywords.join(" ");
      const bundle = await searchAllSources(query);
      return {
        sceneId: a.sceneId,
        keywords: a.keywords,
        position: a.position,
        kindPreference: a.kindPreference,
        rationale: a.rationale,
        clips: bundle.clips.slice(0, 4),
        images: bundle.images.slice(0, 4),
        gifs: bundle.gifs.slice(0, 4),
      } satisfies SuggestResponseItem;
    }),
  );

  return Response.json({ suggestions: results });
}
