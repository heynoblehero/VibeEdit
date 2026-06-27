import { NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { requireServerSession } from "@/lib/server-session";
import { readBrandKit, writeBrandKit } from "@/lib/brand-kit";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

// POST /api/brand-kit/voice
// Accepts a multipart form with:
//   file: audio sample (mp3/wav/webm/m4a, ≥30s recommended)
//   name: optional display name for the voice
// Requires the user to have their own ElevenLabs API key in localStorage (sent as header).
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const apiKey = req.headers.get("x-elevenlabs-key") || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message:
          "No ElevenLabs API key found. Add yours at /app/settings/api-keys, then try again.",
      },
      { status: 402 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const name = String(form.get("name") || "My Voice");

  if (!(file instanceof File)) {
    return new NextResponse("invalid — expected file field", { status: 400 });
  }

  const allowedTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
  ];
  if (!allowedTypes.some((t) => file.type.startsWith(t.split("/")[0]))) {
    return NextResponse.json(
      { error: "invalid_format", message: "Upload an audio file (mp3, wav, webm, m4a)." },
      { status: 400 },
    );
  }

  // Save sample locally first (so we can serve it for playback).
  // Sanitize: ext is concatenated into a filesystem path — strip non-alphanumerics
  // so a crafted filename can't smuggle in "/" or "..".
  const ext = (file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webm").slice(0, 5);
  const dir = join(STORAGE_ROOT, "brand-kits", userId);
  mkdirSync(dir, { recursive: true });
  const sampleFilename = `voice-sample.${ext}`;
  const samplePath = join(dir, sampleFilename);
  writeFileSync(samplePath, Buffer.from(await file.arrayBuffer()));
  const sampleServePath = `/api/brand-kit/file/voice-sample.${ext}`;

  // Delete existing cloned voice if there is one.
  const existing = await readBrandKit(userId);
  if (existing.voiceId) {
    await fetch(`https://api.elevenlabs.io/v1/voices/${existing.voiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    }).catch(() => {}); // best-effort
  }

  // Call ElevenLabs voice cloning API.
  const elForm = new FormData();
  elForm.append("name", name);
  elForm.append("files", new Blob([await file.arrayBuffer()], { type: file.type }), file.name);
  elForm.append("description", `Cloned from VibeEdit for ${name}`);

  const elRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: elForm,
  });

  if (!elRes.ok) {
    const errText = await elRes.text().catch(() => "unknown error");
    return NextResponse.json(
      {
        error: "elevenlabs_error",
        message: `ElevenLabs returned ${elRes.status}: ${errText.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }

  const elData = (await elRes.json()) as { voice_id: string };
  writeBrandKit(userId, {
    voiceId: elData.voice_id,
    voiceSamplePath: sampleServePath,
  });

  return NextResponse.json({
    ok: true,
    voiceId: elData.voice_id,
    voiceSamplePath: sampleServePath,
  });
}

// DELETE /api/brand-kit/voice — removes the cloned voice from ElevenLabs and the DB.
export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const apiKey = req.headers.get("x-elevenlabs-key") || process.env.ELEVENLABS_API_KEY;
  const kit = await readBrandKit(userId);

  if (kit.voiceId && apiKey) {
    await fetch(`https://api.elevenlabs.io/v1/voices/${kit.voiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    }).catch(() => {});
  }

  writeBrandKit(userId, { voiceId: null, voiceSamplePath: null });
  return NextResponse.json({ ok: true });
}
