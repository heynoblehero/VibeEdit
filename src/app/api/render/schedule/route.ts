import type { NextRequest } from "next/server";
import type { Project, RenderPresetId } from "@/lib/scene-schema";
import { cancelScheduled, listScheduled, schedule } from "@/lib/server/scheduler";

export const runtime = "nodejs";

interface ScheduleRequest {
  runAt: string; // ISO timestamp
  project: Project;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  presetId?: RenderPresetId;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ScheduleRequest;
  const runAt = Date.parse(body.runAt);
  if (Number.isNaN(runAt)) {
    return Response.json({ error: "runAt must be ISO timestamp" }, { status: 400 });
  }
  if (!body.project?.scenes?.length) {
    return Response.json({ error: "project.scenes required" }, { status: 400 });
  }
  const sr = schedule({
    runAt,
    project: body.project,
    characters: body.characters ?? {},
    sfx: body.sfx ?? {},
    presetId: body.presetId ?? "1080p",
    origin: request.nextUrl.origin,
  });
  return Response.json({
    id: sr.id,
    runAt: new Date(sr.runAt).toISOString(),
  });
}

export async function GET() {
  return Response.json({ scheduled: listScheduled() });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const ok = cancelScheduled(id);
  return Response.json({ ok });
}
