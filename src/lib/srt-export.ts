import type { Project } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";

/**
 * Build an SRT (SubRip) subtitle file from project voiceover captions.
 * Each scene's captions are translated to global ms (sceneStartSec
 * shifts each entry's startMs/endMs forward) and grouped into ~3-word
 * subtitle cues for readability.
 */
export function projectToSRT(project: Project): string {
  const lines: string[] = [];
  let cueIndex = 1;
  let frameOffset = 0;
  for (const scene of project.scenes) {
    if (scene.muted) {
      frameOffset += sceneDurationFrames(scene, project.fps);
      continue;
    }
    const sceneStartSec = frameOffset / project.fps;
    const captions = scene.voiceover?.captions ?? [];
    if (captions.length > 0) {
      // Group into 3-word chunks so each cue is comfortably readable.
      for (let i = 0; i < captions.length; i += 3) {
        const chunk = captions.slice(i, i + 3);
        const start = sceneStartSec + chunk[0].startMs / 1000;
        const end = sceneStartSec + chunk[chunk.length - 1].endMs / 1000;
        const text = chunk.map((c) => c.word).join(" ");
        lines.push(String(cueIndex++));
        lines.push(`${tc(start)} --> ${tc(end)}`);
        lines.push(text);
        lines.push("");
      }
    } else if (scene.voiceover?.text) {
      // No word-level captions — emit the whole VO line for the
      // scene's duration as a single cue.
      const dur = sceneDurationFrames(scene, project.fps) / project.fps;
      lines.push(String(cueIndex++));
      lines.push(`${tc(sceneStartSec)} --> ${tc(sceneStartSec + dur)}`);
      lines.push(scene.voiceover.text);
      lines.push("");
    }
    frameOffset += sceneDurationFrames(scene, project.fps);
  }
  return lines.join("\n");
}

function tc(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms - h * 3600000) / 60000);
  const s = Math.floor((ms - h * 3600000 - m * 60000) / 1000);
  const z = ms - h * 3600000 - m * 60000 - s * 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(z, 3)}`;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}
