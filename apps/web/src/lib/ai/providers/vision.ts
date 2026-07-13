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

export interface RecreationBrief {
  grade: string; // color grade / look, e.g. "warm teal-orange, crushed blacks"
  pacing: string; // cut rhythm, e.g. "fast 0.4–0.8s cuts, beat-synced"
  typography: string; // on-screen text style
  effects: string[]; // named techniques, e.g. ["speed ramp", "whip pan", "zoom punch-in"]
  layout: string; // framing / composition notes
  summary: string; // one-paragraph recreation plan
}

const RECREATION_INSTRUCTION =
  "You are a motion-design director. These frames are sampled from a reference " +
  "video the user wants to RECREATE the STYLE of (not copy the footage). Describe " +
  "the technique so it can be rebuilt from scratch. Respond with a STRICT JSON " +
  'object and nothing else, shaped exactly like: {"grade": "<color grade/look>", ' +
  '"pacing": "<cut rhythm/speed>", "typography": "<on-screen text style>", ' +
  '"effects": ["named", "techniques"], "layout": "<framing/composition>", ' +
  '"summary": "<one-paragraph plan to recreate this as an original video>"}. ' +
  "Be concrete and name transitions/effects a video editor would use.";

/**
 * Analyze reference frames and return a structured brief the agent maps onto
 * registry blocks + grade/typography presets when recreating a style. Mirrors
 * captionImage's Claude-vision plumbing but takes several frames at once.
 */
export async function describeForRecreation(opts: {
  apiKey?: string;
  frames: string[]; // image data URIs (or bare base64), up to 4 used
  signal?: AbortSignal;
}): Promise<RecreationBrief> {
  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || "";
  const imageBlocks = opts.frames.slice(0, 4).map((frame) => {
    const { mediaType, data } = parseDataUri(frame);
    return {
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType, data },
    };
  });

  const response = await fetch(`${baseURL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: RECREATION_INSTRUCTION }, ...imageBlocks],
        },
      ],
    }),
    signal: opts.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`claude recreation brief failed: ${response.status} ${text.slice(0, 400)}`);
  }
  const message = (await response.json()) as AnthropicMessage;
  const content = (message.content?.find((b) => b.type === "text")?.text ?? "").trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  const jsonSlice = start !== -1 && end > start ? content.slice(start, end + 1) : content;

  const fallback: RecreationBrief = {
    grade: "",
    pacing: "",
    typography: "",
    effects: [],
    layout: "",
    summary: content.slice(0, 600),
  };
  try {
    const parsed = JSON.parse(jsonSlice) as Partial<RecreationBrief>;
    return {
      grade: typeof parsed.grade === "string" ? parsed.grade : "",
      pacing: typeof parsed.pacing === "string" ? parsed.pacing : "",
      typography: typeof parsed.typography === "string" ? parsed.typography : "",
      effects: Array.isArray(parsed.effects)
        ? parsed.effects.filter((e): e is string => typeof e === "string")
        : [],
      layout: typeof parsed.layout === "string" ? parsed.layout : "",
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
    };
  } catch {
    return fallback;
  }
}

// Vision model for yes/no photo verification. Reuses the caption model by default
// (same vision-capable Claude) but can be pinned separately via env.
const VERIFY_MODEL =
  process.env.VISION_VERIFY_MODEL || process.env.VISION_CAPTION_MODEL || "claude-sonnet-4-6";

/**
 * Ask the vision model whether a photo clearly shows a free-form target subject
 * (e.g. "a toothbrush"). Same Claude-via-proxy plumbing as captionImage, returning
 * a simple { match, reason } verdict. Used by the Rise alarm app's photo-proof
 * mission through /api/photo-verify, so the model credential stays server-side.
 */
export async function verifyPhoto(opts: {
  // Optional BYOK Anthropic key; falls back to the server proxy credential.
  apiKey?: string;
  // Base64 image data, either bare or as a "data:image/...;base64,..." URI.
  image: string;
  mediaType?: string;
  target: string;
  signal?: AbortSignal;
}): Promise<{ match: boolean; reason: string }> {
  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || "";
  const { mediaType, data } = opts.image.startsWith("data:")
    ? parseDataUri(opts.image)
    : { mediaType: opts.mediaType || "image/jpeg", data: opts.image };
  const target = opts.target.trim().slice(0, 200);
  const prompt =
    `Does this photo clearly show ${target}? Be reasonably lenient about angle, lighting ` +
    "and framing, but the subject must actually be present. Respond with a STRICT JSON object " +
    'and nothing else, shaped exactly like: {"match": true|false, "reason": "<short reason>"}';

  const response = await fetch(`${baseURL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: VERIFY_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
          ],
        },
      ],
    }),
    signal: opts.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`claude verify failed: ${response.status} ${text.slice(0, 400)}`);
  }
  const message = (await response.json()) as AnthropicMessage;
  const content = (message.content?.find((b) => b.type === "text")?.text ?? "").trim();
  // Claude may wrap JSON in prose/fences — extract the first {...} block.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  const jsonSlice = start !== -1 && end > start ? content.slice(start, end + 1) : content;
  try {
    const parsed = JSON.parse(jsonSlice) as { match?: unknown; reason?: unknown };
    return {
      match: parsed.match === true,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : "",
    };
  } catch {
    // Model ignored the JSON instruction — fail safe by NOT asserting a match.
    return { match: false, reason: content.slice(0, 240) };
  }
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
