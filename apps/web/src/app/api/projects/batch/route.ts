import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { ensureProjectDir } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

// Variants applied as suffixes to the base prompt. Each forces a different
// creative direction so users get diverse drafts in parallel.
const VARIANTS: Array<{ label: string; suffix: string }> = [
  {
    label: "Punchy",
    suffix:
      "Make this variant punchy and high-energy — bold typography, tight cuts, one big climax beat.",
  },
  {
    label: "Cinematic",
    suffix:
      "Make this variant cinematic and slow — wider compositions, longer holds, restrained FX, premium feel.",
  },
  {
    label: "Maximalist",
    suffix:
      "Make this variant maximalist — layered FX, dense typography, more scene changes, busy backgrounds.",
  },
  {
    label: "Minimal",
    suffix: "Make this variant minimal — one idea per scene, generous negative space, no extra FX.",
  },
  {
    label: "Alt palette",
    suffix: "Make this variant with an unexpected color palette that still fits the niche.",
  },
];

const MAX_VARIANTS = 5;

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    basePrompt?: string;
    variants?: number;
    baseName?: string;
  };
  const basePrompt = (body.basePrompt || "").trim();
  if (!basePrompt) {
    return NextResponse.json({ error: "basePrompt required" }, { status: 400 });
  }
  const count = Math.max(2, Math.min(MAX_VARIANTS, Number(body.variants) || 3));
  const baseName = (body.baseName || basePrompt).slice(0, 60);
  const now = new Date();
  const created: Array<{ id: string; label: string; seedPrompt: string }> = [];

  for (let i = 0; i < count; i++) {
    const variant = VARIANTS[i % VARIANTS.length];
    const id = nanoid(10);
    db.insert(projects)
      .values({
        id,
        userId,
        name: `${baseName} — ${variant.label}`,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    ensureProjectDir(userId, id);
    const seedPrompt = `${basePrompt}\n\n${variant.suffix}`;
    // Seed an initial user message so the editor's chat shows the brief
    // when the user opens the project.
    db.insert(messages)
      .values({
        id: nanoid(12),
        projectId: id,
        role: "user",
        content: JSON.stringify(seedPrompt),
        createdAt: now,
      })
      .run();
    created.push({ id, label: variant.label, seedPrompt });
  }

  return NextResponse.json({ projects: created });
}
