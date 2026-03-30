import { NextRequest, NextResponse } from "next/server";
import { spawnClaude } from "@/lib/ai/claude-bridge";
import { logSecurity } from "@/lib/ai/security-log";
import { deductCredits, hasEnoughCredits } from "@/lib/credits";
import { getCreditCost } from "@/lib/credits/costs";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

//  Rate limiting 
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
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

//  System prompt 
function buildStoryboardSystemPrompt(
  mediaAssets: Array<{ id: string; name: string; type: string; duration?: number }>,
  style: string,
): string {
  const assetsDescription =
    mediaAssets.length > 0
      ? `Available media assets in this project:\n${mediaAssets
          .map(
            (a) =>
              `- ${a.name} (${a.type}${a.duration ? `, ${a.duration.toFixed(1)}s` : ""}, id: "${a.id}")`
          )
          .join("\n")}`
      : "No media assets are available in this project. You must use insert_text, insert_generated_image, create_remotion_effect, and use_template to build scenes from scratch.";

  return `You are a professional video director and editor. The user wants to create a video and you must plan it scene by scene.

For each scene, provide the exact editor actions needed to create it in the video editor.

## Style
The video style is: ${style}
- professional: Clean, corporate look. Solid backgrounds, readable typography, smooth transitions.
- casual: Relaxed, friendly. Colorful backgrounds, casual fonts, playful effects.
- cinematic: Dramatic, high-impact. Dark backgrounds, bold text, film-grain effects, dramatic reveals.
- fun: Energetic, vibrant. Bright colors, bouncy animations, emoji-style elements.

## Available Media
${assetsDescription}

## Available Editor Actions

You can use ANY of the following tools in aiActions. Each scene should include all the actions needed to build that scene.

### insert_text
Insert a text element.
Parameters: content (string), startTime (number, seconds), duration (number, default 5), fontSize (number, default 48), fontFamily (string, default "Inter"), color (string, hex), textAlign ("left"|"center"|"right"), fontWeight ("normal"|"bold"), position ({x: number, y: number} relative to canvas center), scale (number), opacity (number 0-1).

### insert_video
Insert a video from the media library.
Parameters: mediaId (string, required), startTime (number), duration (number), position ({x, y}), scale (number), opacity (number 0-1).

### insert_image
Insert an image from the media library.
Parameters: mediaId (string, required), startTime (number), duration (number), position ({x, y}), scale (number), opacity (number 0-1).

### insert_generated_image
Generate a procedural image (solid color, gradient, pattern) using Canvas 2D and insert it.
Parameters: color (string, CSS color for solid fill), code (string, Canvas 2D drawing code - ctx/width/height available), startTime (number), duration (number), name (string), width (number), height (number), position ({x, y}), scale (number), opacity (number 0-1).
At least one of color or code must be provided.

Example codes:
- Solid black: color: "#000000" (no code needed)
- Gradient: code: "var g = ctx.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);"
- Grid on black: color: "#000000", code: "ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; var step = 40; for (var x = 0; x <= width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); } for (var y = 0; y <= height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }"

### insert_audio
Insert audio from the media library.
Parameters: mediaId (string, required), startTime (number), duration (number), volume (number 0-1).

### create_remotion_effect
Create animated motion graphics using React/Remotion.
Parameters: name (string), startTime (number), duration (number), code (string - JS function body receiving { frame, fps, width, height } returning JSX via React.createElement).
Use React.createElement() NOT JSX. Use interpolate() for smooth animations.

Example: Fade-in title:
code: "({ frame, fps }) => { const opacity = Math.min(frame / 30, 1); return React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement('h1', { style: { fontSize: 80, color: 'white', opacity, textShadow: '0 4px 20px rgba(0,0,0,0.5)' } }, 'TITLE')); }"

### use_template
Apply a pre-built animation template.
Parameters: templateId (string, one of: "youtube-intro", "lower-third", "subscribe-button", "countdown-timer", "title-card", "text-reveal", "progress-bar", "fade-transition"), startTime (number), customProps (object - varies per template).

### add_effect
Add a visual effect to an existing element.
Parameters: trackId (string), elementId (string), effectType (string: "blur", "brightness", "contrast", "saturate", "grayscale", "sepia", "invert", "hue-rotate", "drop-shadow").

### upsert_keyframe
Add animation keyframes to an element.
Parameters: trackId (string), elementId (string), propertyPath (string: "transform.position.x", "transform.position.y", "transform.scale", "transform.rotate", "opacity", "volume", "color"), time (number, seconds relative to element start), value (number|string), interpolation ("linear"|"hold").

### batch_update
Update multiple elements at once.
Parameters: filter (object: { type?: string, name?: string }), updates (object of properties).

## Tool selection rules
- STATIC visuals (backgrounds, gradients, patterns) -> insert_generated_image
- ANIMATED visuals (motion graphics, animated text, effects) -> create_remotion_effect
- Pre-built animations (intros, lower thirds) -> use_template
- Existing media (uploaded videos, images, audio) -> insert_video, insert_image, insert_audio

## Output format

You MUST respond with valid JSON only. Return a JSON array of scene objects. Each scene object has:
- title (string): Short scene title
- description (string): What happens in this scene
- duration (number): Scene duration in seconds
- visualType (string): One of "text", "image", "video", "generated", "effect"
- aiActions (array): Array of { tool: string, params: object } actions to execute for this scene
- suggestedText (string, optional): Main text content for this scene
- suggestedColor (string, optional): Primary color for this scene
- suggestedEffect (string, optional): Main visual effect name
- notes (string, optional): Director's notes

IMPORTANT rules:
1. startTime values should be cumulative - each scene starts after the previous one ends
2. Every scene MUST have at least one action in aiActions
3. Keep total duration close to the target duration
4. Use insert_generated_image for backgrounds, then layer text/effects on top
5. Reference media assets by their exact id when available
6. Respond ONLY with valid JSON. No markdown, no explanation.`;
}

//  JSON schema for Claude response 
const STORYBOARD_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          duration: { type: "number" },
          visualType: {
            type: "string",
            enum: ["text", "image", "video", "generated", "effect"],
          },
          aiActions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tool: { type: "string" },
                params: { type: "object" },
              },
              required: ["tool", "params"],
            },
          },
          suggestedText: { type: "string" },
          suggestedColor: { type: "string" },
          suggestedEffect: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "description", "duration", "visualType", "aiActions"],
      },
    },
  },
  required: ["scenes"],
};

//  Route handler 
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // CSRF protection
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || "localhost:3001";
    const allowedOrigin = `http://${host}`;
    const allowedOriginHttps = `https://${host}`;

    if (origin && origin !== allowedOrigin && origin !== allowedOriginHttps) {
      logSecurity("error", "csrf_blocked", {
        ip,
        origin,
        endpoint: "/api/storyboard/generate",
      });
      return NextResponse.json(
        { error: "Forbidden: invalid origin" },
        { status: 403 }
      );
    }

    // Rate limit
    if (!checkRateLimit(ip)) {
      logSecurity("warn", "rate_limit_hit", {
        ip,
        endpoint: "/api/storyboard/generate",
      });
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    // Auth + credits
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userId = session?.user?.id || "anonymous";

    const storyboardCost = getCreditCost("storyboard_generate");
    if (storyboardCost > 0) {
      const hasCredits = hasEnoughCredits(userId, storyboardCost);
      if (!hasCredits) {
        return NextResponse.json(
          {
            error: "No credits remaining. Purchase more credits to continue.",
            result: "",
          },
          { status: 402 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { concept, targetDuration, style, mediaAssets } = body as {
      concept?: string;
      targetDuration?: number;
      style?: string;
      mediaAssets?: Array<{
        id: string;
        name: string;
        type: string;
        duration?: number;
      }>;
    };

    if (!concept || typeof concept !== "string") {
      return NextResponse.json(
        { error: "Video concept description is required" },
        { status: 400 }
      );
    }

    if (concept.length > 5000) {
      return NextResponse.json(
        { error: "Concept description too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    const duration = targetDuration ?? 60;
    const videoStyle = style ?? "professional";
    const assets = mediaAssets ?? [];

    logSecurity("info", "storyboard_generate_request", {
      ip,
      conceptLength: concept.length,
      targetDuration: duration,
      style: videoStyle,
    });

    // Build prompt
    const systemPrompt = buildStoryboardSystemPrompt(assets, videoStyle);
    const userPrompt = `Create a complete video storyboard for the following concept:

"${concept}"

Target video duration: ${duration} seconds
Number of scenes: aim for ${Math.max(3, Math.ceil(duration / 10))} to ${Math.max(5, Math.ceil(duration / 5))} scenes

Plan each scene with specific editor actions. Make the total scene durations add up to approximately ${duration} seconds.

Respond ONLY with a JSON array of scene objects.`;

    const schemaJson = JSON.stringify(STORYBOARD_SCHEMA, null, 2);

    const cliResult = await spawnClaude(systemPrompt, userPrompt, schemaJson);

    // Extract text result
    let resultText = cliResult.result || "";
    if (cliResult.structured_output?.message) {
      resultText = cliResult.structured_output.message;
    }

    // Deduct credits
    if (storyboardCost > 0) {
      deductCredits(
        userId,
        storyboardCost,
        "storyboard_generate",
        `Storyboard generation: "${concept.slice(0, 50)}..."`
      );
    }

    return NextResponse.json({ result: resultText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Storyboard generation error:", message);

    if (message.includes("Failed to spawn")) {
      return NextResponse.json(
        {
          error:
            "Claude CLI not found. Make sure 'claude' is installed and in PATH.",
          result: "",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message, result: "" },
      { status: 500 }
    );
  }
}
