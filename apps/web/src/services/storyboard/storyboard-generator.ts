import type { Storyboard, StoryboardScene } from "@/types/storyboard";
import type { SerializedMediaAsset } from "@/lib/ai/types";

export interface GenerateStoryboardParams {
  concept: string;
  targetDuration: number;
  style: string;
  mediaAssets: SerializedMediaAsset[];
}

interface RawScene {
  title?: unknown;
  description?: unknown;
  duration?: unknown;
  visualType?: unknown;
  aiActions?: unknown;
  suggestedText?: unknown;
  suggestedColor?: unknown;
  suggestedEffect?: unknown;
  notes?: unknown;
}

function validateScene(raw: RawScene): boolean {
  if (typeof raw.title !== "string" || !raw.title) return false;
  if (typeof raw.description !== "string" || !raw.description) return false;
  if (typeof raw.duration !== "number" || raw.duration <= 0) return false;
  if (
    typeof raw.visualType !== "string" ||
    !["text", "image", "video", "generated", "effect"].includes(raw.visualType)
  )
    return false;
  if (!Array.isArray(raw.aiActions)) return false;
  return true;
}

function parseScenesFromResponse(text: string): RawScene[] {
  let jsonStr = text;

  // Strip markdown code fences if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to find JSON in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error(
          `Failed to parse storyboard response as JSON: ${jsonStr.slice(0, 200)}`
        );
      }
    } else {
      throw new Error(
        `Failed to parse storyboard response as JSON: ${jsonStr.slice(0, 200)}`
      );
    }
  }

  // Handle both { scenes: [...] } and direct array
  let scenes: RawScene[];
  if (Array.isArray(parsed)) {
    scenes = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    "scenes" in parsed &&
    Array.isArray((parsed as { scenes: unknown }).scenes)
  ) {
    scenes = (parsed as { scenes: RawScene[] }).scenes;
  } else {
    throw new Error("Response is not a valid scenes array");
  }

  return scenes;
}

export async function generateStoryboard({
  concept,
  targetDuration,
  style,
  mediaAssets,
}: GenerateStoryboardParams): Promise<Storyboard> {
  const response = await fetch("/api/storyboard/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concept,
      targetDuration,
      style,
      mediaAssets,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Storyboard generation failed (${response.status})`);
  }

  const data = await response.json();
  const resultText: string = data.result || "";

  const rawScenes = parseScenesFromResponse(resultText);
  const validScenes = rawScenes.filter(validateScene);

  if (validScenes.length === 0) {
    throw new Error("No valid scenes were generated. Please try again with a different concept.");
  }

  const scenes: StoryboardScene[] = validScenes.map((raw, index) => ({
    id: crypto.randomUUID(),
    order: index + 1,
    title: String(raw.title),
    description: String(raw.description),
    duration: raw.duration as number,
    visualType: raw.visualType as StoryboardScene["visualType"],
    aiActions: (raw.aiActions as StoryboardScene["aiActions"]) || [],
    approved: false,
    executed: false,
    suggestedText: typeof raw.suggestedText === "string" ? raw.suggestedText : undefined,
    suggestedColor: typeof raw.suggestedColor === "string" ? raw.suggestedColor : undefined,
    suggestedEffect: typeof raw.suggestedEffect === "string" ? raw.suggestedEffect : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  }));

  return {
    id: crypto.randomUUID(),
    concept,
    targetDuration,
    style,
    scenes,
    createdAt: Date.now(),
  };
}
