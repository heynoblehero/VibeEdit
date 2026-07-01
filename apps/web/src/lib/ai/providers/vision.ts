/*
 * Minimal Claude vision client for image captioning.
 *
 * The product's brain is already Claude (via ANTHROPIC_BASE_URL — a proxy in
 * prod), so captioning routes through the SAME endpoint/credential rather than
 * a separate OpenAI key. We hit the Anthropic Messages API with a vision-capable
 * Claude model and ask for a strict JSON object so the rest of the app gets a
 * clean { caption, tags } for b-roll selection and reference matching.
 */

const CAPTION_MODEL = process.env.VISION_CAPTION_MODEL || "claude-sonnet-4-6";
const MAX_CAPTION_LENGTH = 240;
const MAX_TAGS = 8;

const CAPTION_INSTRUCTION =
  "Describe this image. Respond with a STRICT JSON object and nothing else, " +
  'shaped exactly like: {"caption": "<one concise sentence describing the ' +
  'image contents>", "tags": ["3-8", "short", "keywords"]}. The tags should be ' +
  "short lowercase keywords for the main subjects, setting, and mood.";

type AnthropicMessage = {
  content?: Array<{ type?: string; text?: string }>;
};

// Split "data:image/png;base64,AAAA" into its media type + raw base64 payload.
function parseDataUri(uri: string): { mediaType: string; data: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(uri);
  if (match) return { mediaType: match[1], data: match[2] };
  // Bare base64 (no data-uri prefix) — assume PNG.
  return { mediaType: "image/png", data: uri };
}

export async function captionImage(opts: {
  // Optional BYOK Anthropic key; falls back to the server proxy credential.
  apiKey?: string;
  imageDataUri: string; // e.g. "data:image/png;base64,...."
  signal?: AbortSignal;
}): Promise<{ caption: string; tags: string[] }> {
  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || "";
  const { mediaType, data } = parseDataUri(opts.imageDataUri);
  const response = await fetch(`${baseURL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CAPTION_INSTRUCTION },
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
          ],
        },
      ],
    }),
    signal: opts.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`claude caption failed: ${response.status} ${text.slice(0, 400)}`);
  }
  const message = (await response.json()) as AnthropicMessage;
  const content = (message.content?.find((b) => b.type === "text")?.text ?? "").trim();

  let caption = "";
  let tags: string[] = [];
  // Claude may occasionally wrap the JSON in prose/```json fences — extract the
  // first {...} block before parsing.
  const jsonSlice = (() => {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    return start !== -1 && end > start ? content.slice(start, end + 1) : content;
  })();
  try {
    const parsed = JSON.parse(jsonSlice) as { caption?: unknown; tags?: unknown };
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
