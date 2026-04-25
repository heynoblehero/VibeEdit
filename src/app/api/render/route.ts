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

  // Preflight: verify every scene's referenced media URL is reachable.
  // The previous failure mode was 'agent reports image attached, render
  // proceeds, file 404s during render, output is bare'. We catch it before
  // the render starts so the user gets a clear list instead of a sad MP4.
  const origin = request.nextUrl.origin;
  const broken: string[] = [];
  await Promise.all(
    body.project.scenes.flatMap((s) => {
      const urls: string[] = [];
      if (s.background?.imageUrl) urls.push(s.background.imageUrl);
      if (s.background?.videoUrl) urls.push(s.background.videoUrl);
      if (s.voiceover?.audioUrl) urls.push(s.voiceover.audioUrl);
      if (s.sceneSfxUrl) urls.push(s.sceneSfxUrl);
      return urls.map(async (url) => {
        const full = url.startsWith("http") ? url : `${origin}${url}`;
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(full, { method: "HEAD", signal: ctrl.signal });
          clearTimeout(to);
          if (!res.ok) broken.push(`scene ${s.id}: ${url} → HTTP ${res.status}`);
        } catch (e) {
          broken.push(
            `scene ${s.id}: ${url} → ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      });
    }),
  );
  if (broken.length > 0) {
    return Response.json(
      {
        error: "Some referenced media files aren't reachable. Fix these before rendering:",
        broken,
      },
      { status: 422 },
    );
  }

  const job = startRenderJob({
    project: body.project,
    characters: body.characters ?? {},
    sfx: body.sfx ?? {},
    origin,
    presetId: body.presetId ?? "1080p",
  });

  return Response.json({ jobId: job.id });
}

export async function GET() {
  return Response.json({ jobs: listJobs() });
}
