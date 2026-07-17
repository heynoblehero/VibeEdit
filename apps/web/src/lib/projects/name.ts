/*
 * Project auto-naming.
 *
 * When a user creates a project without typing a name, we derive a good one
 * from their "describe it" text using the same Claude endpoint the rest of the
 * app already uses (ANTHROPIC_BASE_URL — a proxy in prod). If there's no
 * description, or the model call fails/times out, we fall back to a friendly
 * random name so a project is NEVER called "Untitled Project".
 */

// A short title needs almost no model. Default to the same Claude the vision
// captioner uses (proven through the prod proxy); set PROJECT_NAME_MODEL to a
// cheaper/faster id like a Haiku where the endpoint exposes it.
const NAME_MODEL = process.env.PROJECT_NAME_MODEL || "claude-sonnet-4-6";
const NAME_TIMEOUT_MS = 4000;
const MAX_NAME_LENGTH = 60;

const ADJECTIVES = [
  "Crimson",
  "Golden",
  "Violet",
  "Neon",
  "Amber",
  "Cobalt",
  "Silver",
  "Emerald",
  "Midnight",
  "Solar",
  "Electric",
  "Velvet",
  "Coral",
  "Frost",
  "Lunar",
  "Scarlet",
  "Azure",
  "Ivory",
  "Radiant",
  "Onyx",
];

const NOUNS = [
  "Harbor",
  "Circuit",
  "Vortex",
  "Falcon",
  "Ember",
  "Summit",
  "Comet",
  "Atlas",
  "Prism",
  "Nomad",
  "Echo",
  "Horizon",
  "Cascade",
  "Beacon",
  "Meridian",
  "Drift",
  "Pulse",
  "Signal",
  "Voyage",
  "Aurora",
];

/** A friendly two-word placeholder, e.g. "Violet Harbor". */
export function randomProjectName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

// Strip quotes/trailing punctuation the model sometimes adds, collapse
// whitespace, and cap the length.
function tidy(raw: string): string {
  const cleaned = raw
    .replace(/^["'`\s]+|["'`.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

type AnthropicMessage = { content?: Array<{ type?: string; text?: string }> };

/**
 * Derive a concise project title from the user's description. Returns a random
 * name when there's no usable description or the model can't be reached.
 */
export async function generateProjectName(description: string | undefined): Promise<string> {
  const brief = (description ?? "").trim();
  if (brief.length < 3) return randomProjectName();

  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return randomProjectName();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAME_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: NAME_MODEL,
        max_tokens: 24,
        messages: [
          {
            role: "user",
            content:
              "Give a short, catchy project title (2-4 words, Title Case) for a video " +
              "described as:\n\n" +
              brief.slice(0, 500) +
              "\n\nReply with ONLY the title — no quotes, no punctuation, no explanation.",
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return randomProjectName();
    const message = (await response.json()) as AnthropicMessage;
    const text = message.content?.find((block) => block.type === "text")?.text ?? "";
    const name = tidy(text);
    // Guard against empty / refusal / a model that echoed the whole prompt.
    if (!name || name.length > MAX_NAME_LENGTH || name.split(/\s+/).length > 8) {
      return randomProjectName();
    }
    return name;
  } catch {
    return randomProjectName();
  } finally {
    clearTimeout(timer);
  }
}
