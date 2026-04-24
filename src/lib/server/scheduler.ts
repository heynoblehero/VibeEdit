import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { startRenderJob } from "./render-jobs";
import type { Project, RenderPresetId } from "@/lib/scene-schema";

const STORE_PATH = path.join(process.cwd(), ".data", "scheduled-renders.json");
try {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
} catch {
  // exists
}

interface ScheduledRender {
  id: string;
  runAt: number;
  project: Project;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  presetId: RenderPresetId;
  origin: string;
  /** Set when the render fires — stores the resulting job id. */
  jobId?: string;
  firedAt?: number;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function readAll(): ScheduledRender[] {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return [];
  }
}
function writeAll(list: ScheduledRender[]) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2));
}

function armTimer(sr: ScheduledRender) {
  const delay = Math.max(0, sr.runAt - Date.now());
  const t = setTimeout(() => {
    fire(sr.id).catch((e) => console.error("scheduled render fire failed:", e));
  }, delay);
  timers.set(sr.id, t);
}

async function fire(id: string) {
  const list = readAll();
  const sr = list.find((x) => x.id === id);
  if (!sr) return;
  if (sr.firedAt) return; // idempotent
  const job = startRenderJob({
    project: sr.project,
    characters: sr.characters,
    sfx: sr.sfx,
    origin: sr.origin,
    presetId: sr.presetId,
  });
  sr.jobId = job.id;
  sr.firedAt = Date.now();
  writeAll(list);
  timers.delete(sr.id);
}

let initialised = false;
function initIfNeeded() {
  if (initialised) return;
  initialised = true;
  for (const sr of readAll()) {
    if (!sr.firedAt) armTimer(sr);
  }
}

export function schedule(input: Omit<ScheduledRender, "id" | "jobId" | "firedAt">): ScheduledRender {
  initIfNeeded();
  const sr: ScheduledRender = { id: randomUUID(), ...input };
  const list = readAll();
  list.push(sr);
  writeAll(list);
  armTimer(sr);
  return sr;
}

export function listScheduled(): ScheduledRender[] {
  initIfNeeded();
  return readAll();
}

export function cancelScheduled(id: string): boolean {
  initIfNeeded();
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  const list = readAll();
  const next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}
