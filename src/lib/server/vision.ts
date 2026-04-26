/**
 * Thin Claude-vision wrapper. Sends an image (URL or local /uploads file)
 * + a question to Sonnet and returns the answer text. Works only in
 * direct-API mode — when bridge mode is active we return null and the
 * caller should fall back to a heuristic.
 */

import path from "node:path";
import fs from "node:fs";
import { applyStoredKeys } from "./runtime-keys";

interface AskAboutImageInput {
  imageUrl: string;
  question: string;
  /** Defaults to the cheap haiku model so vision calls stay sub-cent. */
  model?: string;
  maxTokens?: number;
}

export async function askAboutImage(
  input: AskAboutImageInput,
): Promise<string | null> {
  applyStoredKeys();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Resolve local /uploads/<name> to a file:// fetchable absolute path so
  // we can base64-encode and pass to the API. Remote URLs go directly.
  let imageBlock: Record<string, unknown>;
  if (input.imageUrl.startsWith("/uploads/")) {
    const filename = input.imageUrl.slice("/uploads/".length);
    const local = path.join(
      process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), "public"),
      "uploads",
      filename,
    );
    if (!fs.existsSync(local)) return null;
    const buf = await fs.promises.readFile(local);
    const ext = path.extname(filename).toLowerCase();
    const mediaType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    imageBlock = {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: buf.toString("base64") },
    };
  } else if (input.imageUrl.startsWith("http")) {
    imageBlock = { type: "image", source: { type: "url", url: input.imageUrl } };
  } else {
    return null;
  }

  const body = {
    model: input.model ?? "claude-haiku-4-5-20251001",
    max_tokens: input.maxTokens ?? 400,
    messages: [
      {
        role: "user",
        content: [imageBlock, { type: "text", text: input.question }],
      },
    ],
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
