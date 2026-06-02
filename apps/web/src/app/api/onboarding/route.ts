import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { messages, projects, user, userPreferences } from "@/lib/db/schema";
import { ensureProjectDir } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

// Niche → starter prompt seeded into the first project.
// All prompts reference an uploaded clip so new users immediately see the
// footage-editing path, which is the primary use case.
const STARTER_PROMPTS: Record<string, { name: string; prompt: string }> = {
  youtube: {
    name: "My first YouTube edit",
    prompt:
      "I've uploaded a video clip. Probe it, transcribe the speech, cut the filler words and long pauses, add sync'd captions (2 words, uppercase, white pill), apply auto color grade, normalize to −14 LUFS, and export 1080p. If no clip is uploaded yet, build me a 15-second cinematic YouTube channel intro instead.",
  },
  shorts: {
    name: "My first Short",
    prompt:
      "Take the uploaded clip and turn it into a punchy 9:16 Short under 60 seconds. Tight cuts, bold uppercase captions, no dead air. If no clip is uploaded, make a 30-second 1080x1920 hook Short with fast cuts and bold typography.",
  },
  wedding: {
    name: "My first wedding highlight",
    prompt:
      "Edit the uploaded wedding footage into a 90-second highlight reel. Warm cinematic grade, slow crossfades, mix in the uploaded music, add title cards for ceremony / first dance / speeches. If no footage uploaded, describe the edit plan instead.",
  },
  corporate: {
    name: "My first corporate edit",
    prompt:
      "Clean up the uploaded interview or presentation recording: cut dead air, normalize audio to −14 LUFS, add animated lower-third name titles for each speaker. If no clip is uploaded yet, build me a 10-second 1920x1080 branded intro instead.",
  },
  education: {
    name: "My first tutorial edit",
    prompt:
      "Clean up the uploaded screen-recording tutorial: cut dead air and filler words, normalize audio, add a lower-third with the topic title, export 1080p. If no clip is uploaded, make a 15-second tutorial intro with monospace type and a clean dark theme.",
  },
  documentary: {
    name: "My first documentary cut",
    prompt:
      "Grade the uploaded footage with a cinematic look, add lower-third location or speaker titles, normalize audio, and export. If no footage is uploaded, plan the edit and ask me to drop my clips.",
  },
  content: {
    name: "My first content edit",
    prompt:
      "Turn the uploaded footage into a highlight reel optimized for social. Tight cuts, captions, background music mix, export 9:16 for Reels/TikTok. If no clip is uploaded yet, make a 30-second 9:16 hook for a content creator channel.",
  },
};

const NICHES = [
  "youtube",
  "shorts",
  "wedding",
  "corporate",
  "education",
  "documentary",
  "content",
  "other",
] as const;
const FORMATS = ["16:9", "9:16", "both"] as const;
const FREQUENCIES = ["daily", "weekly", "occasional", "experimenting"] as const;

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  if (!row) {
    return NextResponse.json({
      niche: null,
      formatPreference: null,
      postFrequency: null,
      onboardingCompleted: false,
      tourCompleted: false,
    });
  }
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    niche?: string;
    formatPreference?: string;
    postFrequency?: string;
    onboardingCompleted?: boolean;
    tourCompleted?: boolean;
  };

  const niche =
    body.niche && NICHES.includes(body.niche as (typeof NICHES)[number]) ? body.niche : undefined;
  const formatPreference =
    body.formatPreference && FORMATS.includes(body.formatPreference as (typeof FORMATS)[number])
      ? body.formatPreference
      : undefined;
  const postFrequency =
    body.postFrequency && FREQUENCIES.includes(body.postFrequency as (typeof FREQUENCIES)[number])
      ? body.postFrequency
      : undefined;

  const existing = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  const now = new Date();
  const wasAlreadyOnboarded = !!existing?.onboardingCompleted;
  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: now };
    if (niche !== undefined) updates.niche = niche;
    if (formatPreference !== undefined) updates.formatPreference = formatPreference;
    if (postFrequency !== undefined) updates.postFrequency = postFrequency;
    if (body.onboardingCompleted !== undefined)
      updates.onboardingCompleted = body.onboardingCompleted;
    if (body.tourCompleted !== undefined) updates.tourCompleted = body.tourCompleted;
    db.update(userPreferences).set(updates).where(eq(userPreferences.userId, userId)).run();
  } else {
    db.insert(userPreferences)
      .values({
        userId,
        niche: niche || null,
        formatPreference: formatPreference || null,
        postFrequency: postFrequency || null,
        onboardingCompleted: body.onboardingCompleted ?? false,
        tourCompleted: body.tourCompleted ?? false,
        updatedAt: now,
      })
      .run();
  }

  // On first onboarding completion: auto-create a niche-seeded starter project
  // so the user lands in an editor with a prompt already queued.
  let firstProjectId: string | null = null;
  if (!wasAlreadyOnboarded && body.onboardingCompleted === true) {
    const startNiche = niche || existing?.niche || null;
    const starter = startNiche ? STARTER_PROMPTS[startNiche] : null;
    if (starter) {
      const id = nanoid(10);
      db.insert(projects)
        .values({
          id,
          userId,
          name: starter.name,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      ensureProjectDir(userId, id);
      // Chat reads message content as a JSON-encoded string or array.
      // JSON.stringify("foo") → `"foo"` which parses back to "foo" — that
      // matches how the chat route stores user messages.
      db.insert(messages)
        .values({
          id: nanoid(12),
          projectId: id,
          role: "user",
          content: JSON.stringify(starter.prompt),
          createdAt: now,
        })
        .run();
      firstProjectId = id;
    }
  }

  // Fire welcome email on first onboarding completion only — fire-and-forget
  if (!wasAlreadyOnboarded && body.onboardingCompleted === true) {
    void (async () => {
      try {
        const owner = db.select().from(user).where(eq(user.id, userId)).get();
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: "Welcome to VibeEdit Video",
            html: welcomeEmail({
              name: owner.name?.split(" ")[0] || "there",
            }),
          });
        }
      } catch (error) {
        console.error("[onboarding] welcome email failed:", error);
      }
    })();
  }

  return NextResponse.json({ ok: true, firstProjectId });
}
