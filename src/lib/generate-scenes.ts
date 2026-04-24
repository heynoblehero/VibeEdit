import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import { type Orientation, type Scene, createId } from "./scene-schema";

const ACCENT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#38bdf8", "#818cf8", "#a78bfa", "#fb923c", "#ec4899"];
const GRAPHICS = ["gradient1", "gradient3", "gradient4", "gradient5", "gradient6"];

function pick<T>(arr: T[], i: number): T {
  return arr[Math.abs(i) % arr.length];
}

export function generateScenesFromScript(
  script: string,
  characters: CharacterAsset[],
  sfx: SfxAsset[],
): Scene[] {
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const scenes: Scene[] = [];
  let charIdx = 0;
  let colorIdx = 0;
  let sfxIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const words = line.split(/\s+/);
    const isShort = words.length <= 4;
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    const isNumber = /^\d+[KkMm]?$/.test(line.trim());

    if (isNumber) {
      const raw = line.trim().toUpperCase();
      let num = parseInt(raw);
      if (raw.endsWith("K")) num = parseInt(raw) * 1000;
      if (raw.endsWith("M")) num = parseInt(raw) * 1000000;
      scenes.push({
        id: createId(),
        type: "big_number",
        duration: 2,
        numberFrom: 0,
        numberTo: num,
        numberSuffix: "",
        numberColor: pick(ACCENT_COLORS, colorIdx++),
        text: lines[i + 1] && !lines[i + 1].match(/^[A-Z\s]+$/) ? undefined : undefined,
        sfxId: sfx.length > 0 ? pick(sfx, sfxIdx++).id : undefined,
        transition: "beat_flash_colored",
        transitionColor: pick(ACCENT_COLORS, colorIdx),
        zoomPunch: 1.2,
        background: { color: "#0a0a0a", vignette: 0.5 },
      });
      continue;
    }

    if (isShort && isAllCaps) {
      scenes.push({
        id: createId(),
        type: "text_only",
        duration: 1.5,
        emphasisText: line,
        emphasisSize: line.length > 15 ? 72 : 110,
        emphasisColor: pick(ACCENT_COLORS, colorIdx++),
        emphasisGlow: `${pick(ACCENT_COLORS, colorIdx)}66`,
        textY: 420,
        sfxId: sfx.length > 0 ? pick(sfx, sfxIdx++).id : undefined,
        transition: "beat_flash",
        zoomPunch: 1.18,
        background: { color: "#0a0a0a", vignette: 0.5 },
      });
      continue;
    }

    const hasChar = characters.length > 0;
    const useRight = i % 2 === 0;

    if (isShort) {
      if (hasChar) {
        scenes.push({
          id: createId(),
          type: "character_pop",
          duration: 1.8,
          characterId: pick(characters, charIdx++).id,
          characterX: 960,
          characterY: 950,
          characterScale: 1.2,
          enterFrom: "scale",
          emphasisText: line,
          emphasisSize: 56,
          emphasisColor: "#aaaaaa",
          textY: 160,
          sfxId: sfx.length > 0 ? pick(sfx, sfxIdx++).id : undefined,
          transition: "beat_flash",
          zoomPunch: 1.12,
          background: { color: "#111111", vignette: 0.5 },
        });
      } else {
        scenes.push({
          id: createId(),
          type: "text_only",
          duration: 2,
          emphasisText: line,
          emphasisSize: 80,
          emphasisColor: "white",
          textY: 440,
          sfxId: sfx.length > 0 ? pick(sfx, sfxIdx++).id : undefined,
          transition: i % 3 === 0 ? "beat_flash" : "none",
          zoomPunch: i % 2 === 0 ? 1.12 : 0,
          background: { color: "#111111", vignette: 0.45 },
        });
      }
      continue;
    }

    const splitAt = Math.ceil(words.length * 0.45);
    const firstHalf = words.slice(0, splitAt).join(" ");
    const secondHalf = words.slice(splitAt).join(" ");

    scenes.push({
      id: createId(),
      type: hasChar ? "character_text" : "text_only",
      duration: words.length > 8 ? 3.5 : 2.5,
      characterId: hasChar ? pick(characters, charIdx++).id : undefined,
      characterX: useRight ? 1500 : 400,
      characterY: 950,
      characterScale: 1.3,
      enterFrom: useRight ? "right" : "left",
      flipCharacter: !useRight,
      text: firstHalf,
      textSize: 60,
      textColor: "#999999",
      textY: 300,
      emphasisText: secondHalf,
      emphasisSize: secondHalf.length > 25 ? 52 : 72,
      emphasisColor: "white",
      sfxId: sfx.length > 0 ? pick(sfx, sfxIdx++).id : undefined,
      transition: i % 3 === 0 ? "beat_flash" : "none",
      shakeIntensity: i % 5 === 0 ? 8 : 0,
      zoomPunch: i % 2 === 0 ? 1.12 : 0,
      background: {
        color: "#111111",
        graphic: i % 4 === 0 ? pick(GRAPHICS, i) : undefined,
        graphicY: 650,
        graphicOpacity: 0.4,
        vignette: 0.45,
      },
    });
  }

  return scenes;
}

export interface StreamHandlers {
  onScene: (scene: Scene) => void;
  onDone: (count: number) => void;
  onError: (message: string) => void;
}

export async function streamScenesFromAI(
  script: string,
  characters: CharacterAsset[],
  sfx: SfxAsset[],
  orientation: Orientation,
  handlers: StreamHandlers,
  options: { extendedThinking?: boolean } = {},
): Promise<void> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script,
      characters: characters.map((c) => c.id),
      sfx: sfx.map((s) => s.id),
      orientation,
      extendedThinking: options.extendedThinking,
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `Generate failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch {
      // ignore — non-JSON response
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice("data: ".length);
      let evt: { type: string; scene?: Scene; count?: number; error?: string };
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === "scene" && evt.scene) {
        handlers.onScene(evt.scene);
      } else if (evt.type === "done") {
        handlers.onDone(evt.count ?? 0);
      } else if (evt.type === "error" && evt.error) {
        handlers.onError(evt.error);
      }
    }
  }
}
