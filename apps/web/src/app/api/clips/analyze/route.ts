import { NextRequest, NextResponse } from "next/server";
import { spawnClaude } from "@/lib/ai/claude-bridge";
import { logSecurity } from "@/lib/ai/security-log";
import { deductCredits, hasEnoughCredits } from "@/lib/credits";
import { getCreditCost } from "@/lib/credits/costs";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

// ── Rate limiting ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // stricter than chat — analysis is expensive
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── System prompt for viral-moment detection ──────────────────
const CLIP_ANALYSIS_SYSTEM_PROMPT = `You are an expert viral content strategist and video editor. Your job is to analyze video transcripts and identify the most compelling, shareable, and viral-worthy moments.

When evaluating moments, consider:
- **Hook strength**: Does the moment start with something attention-grabbing?
- **Emotional impact**: Does it evoke surprise, humor, inspiration, curiosity, or controversy?
- **Standalone value**: Can this clip make sense and be compelling on its own without context?
- **Shareability**: Would someone want to share this with others?
- **Pacing**: Is the content tight and engaging, without dead air or rambling?
- **Quotability**: Does it contain a memorable phrase, hot take, or sound bite?

You MUST respond with valid JSON only. No markdown, no explanation, just a JSON object.`;

// ── JSON schema that Claude must follow ───────────────────────
const CLIP_MOMENT_SCHEMA = {
  type: "object",
  properties: {
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startTime: {
            type: "number",
            description: "Start time in seconds",
          },
          endTime: {
            type: "number",
            description: "End time in seconds",
          },
          title: {
            type: "string",
            description:
              "Short, catchy title for this clip (max 60 chars, suitable for a TikTok caption)",
          },
          reason: {
            type: "string",
            description:
              "Brief explanation of why this moment is viral-worthy",
          },
          score: {
            type: "number",
            description: "Virality score from 1-100",
          },
          transcript: {
            type: "string",
            description:
              "The exact transcript text included in this clip",
          },
          hashtags: {
            type: "array",
            items: { type: "string" },
            description:
              "3-5 relevant hashtags for this clip (without the # symbol)",
          },
        },
        required: [
          "startTime",
          "endTime",
          "title",
          "reason",
          "score",
          "transcript",
          "hashtags",
        ],
      },
    },
  },
  required: ["moments"],
};

// ── Helper: build the user prompt ─────────────────────────────
function buildUserPrompt(
  transcript: string,
  settings: { minClipDuration: number; maxClipDuration: number; maxClips: number },
): string {
  return `Analyze this video transcript and find the most viral, engaging moments that would perform well as short-form clips on TikTok, YouTube Shorts, and Instagram Reels.

**Constraints:**
- Each clip must be between ${settings.minClipDuration} and ${settings.maxClipDuration} seconds long
- Find up to ${settings.maxClips} clips maximum
- Clips should not overlap significantly
- Rank them by virality score (1-100)
- Start/end times must align with the timestamps in the transcript
- Prefer clean start/end points (beginning/end of sentences)

**Transcript:**
${transcript}

Respond ONLY with a JSON object matching this schema:
${JSON.stringify(CLIP_MOMENT_SCHEMA, null, 2)}`;
}

// ── Helpers for parsing/validating ────────────────────────────
interface RawMoment {
  startTime: unknown;
  endTime: unknown;
  title: unknown;
  reason: unknown;
  score: unknown;
  transcript: unknown;
  hashtags: unknown;
}

function validateMoment(
  raw: RawMoment,
  settings: { minClipDuration: number; maxClipDuration: number },
): boolean {
  if (typeof raw.startTime !== "number" || typeof raw.endTime !== "number")
    return false;
  if (typeof raw.title !== "string" || typeof raw.reason !== "string")
    return false;
  if (typeof raw.score !== "number") return false;
  if (raw.endTime <= raw.startTime) return false;

  const duration = raw.endTime - raw.startTime;
  if (duration < settings.minClipDuration * 0.8) return false; // allow small tolerance
  if (duration > settings.maxClipDuration * 1.2) return false;

  return true;
}

function parseMomentsFromResponse(
  text: string,
  settings: { minClipDuration: number; maxClipDuration: number },
): Array<{
  startTime: number;
  endTime: number;
  title: string;
  reason: string;
  score: number;
  transcript: string;
  hashtags: string[];
}> {
  // Strip markdown code fences if present
  let jsonStr = text;
  const codeBlockMatch = jsonStr.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
  );
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try parsing the full response
  let parsed: { moments?: RawMoment[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Maybe the response is an array directly
    try {
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) {
        parsed = { moments: arr };
      } else {
        throw new Error("Response is not a valid JSON object or array");
      }
    } catch {
      throw new Error(
        `Failed to parse Claude response as JSON: ${jsonStr.slice(0, 200)}`,
      );
    }
  }

  const rawMoments = parsed.moments;
  if (!Array.isArray(rawMoments)) {
    throw new Error("Response missing 'moments' array");
  }

  return rawMoments
    .filter((m) => validateMoment(m, settings))
    .map((m) => ({
      startTime: m.startTime as number,
      endTime: m.endTime as number,
      title: String(m.title).slice(0, 100),
      reason: String(m.reason).slice(0, 300),
      score: Math.min(100, Math.max(1, Math.round(m.score as number))),
      transcript: typeof m.transcript === "string" ? m.transcript : "",
      hashtags: Array.isArray(m.hashtags)
        ? (m.hashtags as unknown[])
            .filter((h): h is string => typeof h === "string")
            .map((h) => h.replace(/^#/, ""))
            .slice(0, 5)
        : [],
    }));
}

// ── Route handler ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    // CSRF protection
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || "localhost:3001";
    const allowedOrigin = `http://${host}`;
    const allowedOriginHttps = `https://${host}`;

    if (
      origin &&
      origin !== allowedOrigin &&
      origin !== allowedOriginHttps
    ) {
      logSecurity("error", "csrf_blocked", {
        ip,
        origin,
        endpoint: "/api/clips/analyze",
      });
      return NextResponse.json(
        { error: "Forbidden: invalid origin" },
        { status: 403 },
      );
    }

    // Rate limit
    if (!checkRateLimit(ip)) {
      logSecurity("warn", "rate_limit_hit", {
        ip,
        endpoint: "/api/clips/analyze",
      });
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

    // Auth + credits
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userId = session?.user?.id || "anonymous";

    const analysisCost = getCreditCost("clip_analysis");
    if (analysisCost > 0) {
      const hasCredits = hasEnoughCredits(userId, analysisCost);
      if (!hasCredits) {
        return NextResponse.json(
          {
            error:
              "No credits remaining. Purchase more credits to continue.",
            moments: [],
          },
          { status: 402 },
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { transcript, settings } = body as {
      transcript?: string;
      settings?: {
        minClipDuration?: number;
        maxClipDuration?: number;
        maxClips?: number;
      };
    };

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    if (transcript.length > 200_000) {
      return NextResponse.json(
        { error: "Transcript too long (max 200,000 characters)" },
        { status: 400 },
      );
    }

    const clipSettings = {
      minClipDuration: settings?.minClipDuration ?? 15,
      maxClipDuration: settings?.maxClipDuration ?? 60,
      maxClips: settings?.maxClips ?? 50,
    };

    logSecurity("info", "clip_analysis_request", {
      ip,
      transcriptLength: transcript.length,
    });

    // Build prompt and call Claude
    const userPrompt = buildUserPrompt(transcript, clipSettings);
    const schemaJson = JSON.stringify(CLIP_MOMENT_SCHEMA, null, 2);

    const cliResult = await spawnClaude(
      CLIP_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      schemaJson,
    );

    // Extract text from result
    let resultText = cliResult.result || "";
    if (cliResult.structured_output?.message) {
      resultText = cliResult.structured_output.message;
    }

    // Parse moments from Claude's response
    const moments = parseMomentsFromResponse(resultText, clipSettings);

    // Assign IDs
    const momentsWithIds = moments.map((m) => ({
      ...m,
      id: crypto.randomUUID(),
    }));

    // Deduct credits
    if (analysisCost > 0) {
      deductCredits(
        userId,
        analysisCost,
        "clip_analysis",
        `Clip analysis: ${momentsWithIds.length} moments found`,
      );
    }

    return NextResponse.json({ moments: momentsWithIds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Clip analysis error:", message);

    if (message.includes("Failed to spawn")) {
      return NextResponse.json(
        {
          error:
            "Claude CLI not found. Make sure 'claude' is installed and in PATH.",
          moments: [],
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: message, moments: [] },
      { status: 500 },
    );
  }
}
