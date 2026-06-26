/*
 * Minimal OpenAI vision client for image captioning.
 *
 * Uses the same OpenAI key the app already requires for transcription. We hit
 * the Chat Completions vision endpoint with gpt-4o-mini and force a strict JSON
 * object so the rest of the app gets a clean { caption, tags } it can use for
 * b-roll selection and reference matching — no SDK, plain fetch.
 */

const CAPTION_MODEL = process.env.VISION_CAPTION_MODEL || "gpt-4o-mini";
const MAX_CAPTION_LENGTH = 240;
const MAX_TAGS = 8;

const CAPTION_INSTRUCTION =
  "Describe this image. Respond with a STRICT JSON object and nothing else, " +
  'shaped exactly like: {"caption": "<one concise sentence describing the ' +
  'image contents>", "tags": ["3-8", "short", "keywords"]}. The tags should be ' +
  "short lowercase keywords for the main subjects, setting, and mood.";

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function captionImage(opts: {
  apiKey: string;
  imageDataUri: string; // e.g. "data:image/png;base64,...."
  signal?: AbortSignal;
}): Promise<{ caption: string; tags: string[] }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CAPTION_INSTRUCTION },
            { type: "image_url", image_url: { url: opts.imageDataUri } },
          ],
        },
      ],
    }),
    signal: opts.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`openai caption failed: ${response.status} ${text.slice(0, 400)}`);
  }
  const data = (await response.json()) as ChatCompletion;
  const content = data.choices?.[0]?.message?.content?.trim() || "";

  let caption = "";
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(content) as { caption?: unknown; tags?: unknown };
    if (typeof parsed.caption === "string") caption = parsed.caption;
    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags.filter((tag): tag is string => typeof tag === "string");
    }
  } catch {
    // Model ignored the JSON instruction — fall back to the raw text.
    caption = content;
    tags = [];
  }

  caption = caption.trim().slice(0, MAX_CAPTION_LENGTH);
  const normalizedTags: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase();
    if (clean && !normalizedTags.includes(clean)) normalizedTags.push(clean);
    if (normalizedTags.length >= MAX_TAGS) break;
  }

  return { caption, tags: normalizedTags };
}

/**
 * Pure heuristic for tagging an audio asset's role from cheap metadata, so the
 * editor can slot it correctly without a network round-trip. Speech wins if
 * detected; very short non-speech clips read as one-shot sound effects;
 * everything else is treated as music.
 */
export function classifyAudio(opts: { durationSeconds: number; hasSpeech: boolean }): {
  audioType: "music" | "sfx" | "speech";
} {
  if (opts.hasSpeech) return { audioType: "speech" };
  if (opts.durationSeconds <= 3) return { audioType: "sfx" };
  return { audioType: "music" };
}
