import type { NextRequest } from "next/server";
import type { Project, RenderPresetId } from "@/lib/scene-schema";
import { listJobs, startRenderJob } from "@/lib/server/render-jobs";
import { sessionFor, userById } from "@/lib/server/auth";
import { getWorkflow } from "@/lib/workflows/registry";

export const runtime = "nodejs";
export const maxDuration = 600;

interface RenderRequest {
  project: Project;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  presetId?: RenderPresetId;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RenderRequest;
  if (!body?.project?.scenes?.length) {
    return Response.json({ error: "project.scenes required" }, { status: 400 });
  }

  // Enforce the paywall only for signed-in users. Anonymous users can render
  // any workflow — the pivot isn't complete until you enable this.
  const cookie = request.cookies.get("vibeedit_session")?.value;
  const session = sessionFor(cookie);
  if (session) {
    const user = userById(session.userId);
    const workflow = getWorkflow(body.project.workflowId);
    if (workflow.paid && user && !user.unlockedWorkflows.includes(workflow.id)) {
      return Response.json(
        {
          error: `"${workflow.name}" is a paid workflow. Unlock it first.`,
          unlockRequired: workflow.id,
        },
        { status: 402 },
      );
    }
  }

  const job = startRenderJob({
    project: body.project,
    characters: body.characters ?? {},
    sfx: body.sfx ?? {},
    origin: request.nextUrl.origin,
    presetId: body.presetId ?? "1080p",
  });

  return Response.json({ jobId: job.id });
}

export async function GET() {
  return Response.json({ jobs: listJobs() });
}
