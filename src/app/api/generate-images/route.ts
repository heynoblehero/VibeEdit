import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

interface GenImagesRequest {
  prompts: string[];
  // "1024x1024" | "1536x1024" | "1024x1536"
  size?: string;
  styleHint?: string;
}

const IMAGE_DIR = path.join(process.cwd(), "public", "ai-images");
try {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
} catch {
  // dir exists
}

function keyFor(prompt: string, size: string, style: string): string {
  return crypto
    .createHash("sha1")
    .update(`${size}:${style}:${prompt}`)
    .digest("hex")
    .slice(0, 20);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not set on server" },
      { status: 503 },
    );
  }
  const body = (await request.json()) as GenImagesRequest;
  if (!Array.isArray(body.prompts) || body.prompts.length === 0) {
    return Response.json({ error: "prompts required" }, { status: 400 });
  }
  const size = body.size ?? "1024x1024";
  const styleHint = body.styleHint ?? "cinematic, moody, rich colors";

  // Generate (or reuse cached) images one at a time to respect rate limits.
  const out: Array<{ url: string; prompt: string; cached: boolean }> = [];
  for (const rawPrompt of body.prompts) {
    const prompt = `${rawPrompt.trim()} — style: ${styleHint}`;
    const key = keyFor(prompt, size, styleHint);
    const filename = `${key}.png`;
    const filePath = path.join(IMAGE_DIR, filename);
    const url = `/ai-images/${filename}`;

    if (fs.existsSync(filePath)) {
      out.push({ url, prompt: rawPrompt, cached: true });
      continue;
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        n: 1,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json(
        {
          error: `image generation failed for "${rawPrompt.slice(0, 60)}": ${res.status} ${errText.slice(0, 200)}`,
          results: out,
        },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return Response.json(
        { error: "no image returned", results: out },
        { status: 502 },
      );
    }
    const buffer = Buffer.from(b64, "base64");
    await fs.promises.writeFile(filePath, buffer);
    out.push({ url, prompt: rawPrompt, cached: false });
  }

  return Response.json({ images: out });
}
