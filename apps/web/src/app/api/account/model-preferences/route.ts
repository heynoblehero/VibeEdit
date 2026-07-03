import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import {
  type ModelPreferences,
  readModelPreferences,
  writeModelPreferences,
} from "@/lib/ai/model-prefs";
import {
  brandLabel,
  isModelConfigured,
  type ModelTask,
  MODELS,
  VIBE_MAX_MODEL_ID,
} from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET/PUT /api/account/model-preferences — the user's Auto/Manual model
// selection. Auth: requireServerSession() — always scoped to the session user,
// never an id from the request, so a caller can only read/write their own prefs.

const ALL_TASKS: ModelTask[] = ["brain", "image", "video", "music", "voice", "motion"];

/**
 * Available models grouped by task, shaped for the picker UI. `configured`
 * tells the UI whether the model can actually run in this deployment so it can
 * grey out / warn on unconfigured (esp. unofficial) options.
 */
function availableModelsByTask() {
  const grouped: Record<string, unknown[]> = {};
  for (const task of ALL_TASKS) grouped[task] = [];
  for (const m of MODELS) {
    if (!m.enabled) continue;
    // The agent brain only runs on Claude — hide non-Claude brains and present
    // the Claude ones branded as Vibe / Vibe Max (never a raw model name).
    const isBrain = m.task === "brain";
    if (isBrain && m.provider !== "anthropic") continue;
    const isVibeMax = m.id === VIBE_MAX_MODEL_ID;
    grouped[m.task].push({
      id: m.id,
      label: isBrain ? brandLabel(m) : m.label,
      task: m.task,
      provider: m.provider,
      official: m.official,
      default: m.default === true,
      costTier: m.costTier,
      note: isBrain && isVibeMax ? "Smartest brain — costs ~2× credits per edit." : m.note,
      configured: isModelConfigured(m),
    });
  }
  return grouped;
}

// GET — returns the user's saved prefs plus the model catalog for rendering.
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;

  const preferences = readModelPreferences(session.user.id);
  return NextResponse.json({ preferences, models: availableModelsByTask() });
}

// PUT — validate + save. writeModelPreferences throws on a bad mode or an
// invalid/disabled choice; we translate that into a 400.
export async function PUT(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;

  const body = (await req.json().catch(() => null)) as Partial<ModelPreferences> | null;
  if (!body || typeof body !== "object") {
    return new NextResponse("invalid body", { status: 400 });
  }

  const prefs: ModelPreferences = {
    mode: body.mode === "manual" ? "manual" : "auto",
    choices: body.choices && typeof body.choices === "object" ? body.choices : {},
  };

  try {
    writeModelPreferences(session.user.id, prefs);
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "invalid preferences", {
      status: 400,
    });
  }

  return NextResponse.json({ preferences: readModelPreferences(session.user.id) });
}
