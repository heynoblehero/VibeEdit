import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireServerSession } from "@/lib/server-session";
import { personaDir } from "@/lib/storage/fs";

type PersonaFile = {
  name?: string;
  description?: string;
  style?: string;
  voiceId?: string;
  base?: string;
  poses?: Array<{ label: string; file: string }>;
  personality?: { traits?: string[]; speakingStyle?: string; catchphrases?: string[] };
  sampleScripts?: string[];
};

// GET — the signed-in user's account-level character(s). A persona is stored
// once per user and reused across every project, so this reads the single
// persona.json from personaDir(userId) and returns it as a (0-or-1 length)
// array. Powers the "Characters" source in the asset uploader.
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const dir = personaDir(userId);
  const file = join(dir, "persona.json");
  if (!existsSync(file)) return NextResponse.json({ characters: [] });

  let persona: PersonaFile;
  try {
    persona = JSON.parse(readFileSync(file, "utf8")) as PersonaFile;
  } catch {
    return NextResponse.json({ characters: [] });
  }

  const base = persona.base || "base.png";
  const character = {
    name: persona.name ?? "Character",
    description: persona.description ?? "",
    style: persona.style ?? "",
    voiceId: persona.voiceId,
    poses: (persona.poses ?? []).map((p) => p.label),
    personality: persona.personality,
    sampleScripts: persona.sampleScripts ?? [],
    hasBase: existsSync(join(dir, base)),
  };

  return NextResponse.json({ characters: [character] });
}
