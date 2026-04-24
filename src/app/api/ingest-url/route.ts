import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

interface IngestRequest {
  url: string;
  kind?: "video" | "audio";
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // exists
}

function ytDlpBin(): string {
  return process.env.YT_DLP_BIN ?? "yt-dlp";
}

function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as IngestRequest;
  if (!body.url?.trim()) {
    return Response.json({ error: "url required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(body.url)) {
    return Response.json({ error: "url must start with http:// or https://" }, { status: 400 });
  }

  const kind = body.kind ?? "video";
  const id = randomUUID();
  const ext = kind === "audio" ? "mp3" : "mp4";
  const filename = `${id}.${ext}`;
  const outPath = path.join(UPLOAD_DIR, filename);

  // -f picks a reasonable format. -o is the output path. --no-playlist avoids
  // accidentally ingesting a whole playlist when given a single-video URL.
  const args =
    kind === "audio"
      ? [
          "-x",
          "--audio-format",
          "mp3",
          "--no-playlist",
          "-o",
          outPath.replace(/\.mp3$/, ".%(ext)s"),
          body.url,
        ]
      : [
          "-f",
          "best[ext=mp4][height<=720]/best[ext=mp4]/best",
          "--no-playlist",
          "-o",
          outPath,
          body.url,
        ];

  try {
    await runYtDlp(args);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // Confirm the file landed; yt-dlp may append its own extension.
  let finalPath = outPath;
  if (!fs.existsSync(finalPath)) {
    // Glob for id.*
    const entries = await fs.promises.readdir(UPLOAD_DIR);
    const match = entries.find((e) => e.startsWith(id + "."));
    if (match) finalPath = path.join(UPLOAD_DIR, match);
  }
  if (!fs.existsSync(finalPath)) {
    return Response.json({ error: "yt-dlp produced no file" }, { status: 502 });
  }
  const stat = await fs.promises.stat(finalPath);

  // Get a title via yt-dlp metadata query (best-effort).
  let title: string | undefined;
  try {
    const { stdout } = await runYtDlp([
      "--print",
      "title",
      "--no-playlist",
      body.url,
    ]);
    title = stdout.trim();
  } catch {
    // ignore
  }

  return Response.json({
    url: `/uploads/${path.basename(finalPath)}`,
    name: title ?? `ingest-${id.slice(0, 8)}`,
    bytes: stat.size,
    kind,
  });
}
