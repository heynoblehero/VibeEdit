import path from "node:path";
import fs from "node:fs";
import type { NextRequest } from "next/server";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

export const runtime = "nodejs";
export const maxDuration = 120;

const CLONES_PATH = path.join(process.cwd(), ".data", "voice-clones.json");
try {
  fs.mkdirSync(path.dirname(CLONES_PATH), { recursive: true });
} catch {
  // exists
}

interface VoiceClone {
  id: string; // ElevenLabs voice id
  name: string;
  createdAt: number;
  sampleUrl?: string;
}

function readClones(): VoiceClone[] {
  if (!fs.existsSync(CLONES_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CLONES_PATH, "utf8"));
  } catch {
    return [];
  }
}
function writeClones(list: VoiceClone[]) {
  fs.writeFileSync(CLONES_PATH, JSON.stringify(list, null, 2));
}

export async function GET() {
  return Response.json({ voices: readClones() });
}

// Creates a cloned voice in ElevenLabs from an uploaded audio sample.
// Multipart: file + name.
export async function POST(request: NextRequest) {
  applyStoredKeys();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not set on server" },
      { status: 503 },
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim() || "My voice";
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("name", name);
  upstream.append("files", file, file.name);
  upstream.append(
    "description",
    "VibeEdit-cloned voice. Used for scene narration.",
  );

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: upstream,
  });
  if (!res.ok) {
    const err = await res.text();
    return Response.json(
      { error: `ElevenLabs error ${res.status}: ${err.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) {
    return Response.json({ error: "no voice_id returned" }, { status: 502 });
  }

  const clone: VoiceClone = {
    id: data.voice_id,
    name,
    createdAt: Date.now(),
  };
  const clones = readClones();
  clones.push(clone);
  writeClones(clones);
  return Response.json({ voice: clone });
}

export async function DELETE(request: NextRequest) {
  applyStoredKeys();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (apiKey) {
    // Best-effort delete in ElevenLabs too.
    await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    }).catch(() => {});
  }
  writeClones(readClones().filter((v) => v.id !== id));
  return Response.json({ ok: true });
}
