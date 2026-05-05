"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-schema";
import { getOrientation } from "@/lib/scene-schema";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";

// Key by a quick content hash of the scene. We recompute when visual fields
// change so users see their edits reflected, but the hash is cheap and ignores
// noisy fields like the scene id itself.
function sceneHash(scene: Scene, orientation: string): string {
  const payload = {
    type: scene.type,
    duration: scene.duration,
    characterId: scene.characterId,
    characterX: scene.characterX,
    characterY: scene.characterY,
    characterScale: scene.characterScale,
    enterFrom: scene.enterFrom,
    flipCharacter: scene.flipCharacter,
    text: scene.text,
    textColor: scene.textColor,
    textY: scene.textY,
    emphasisText: scene.emphasisText,
    emphasisColor: scene.emphasisColor,
    emphasisSize: scene.emphasisSize,
    emphasisGlow: scene.emphasisGlow,
    numberFrom: scene.numberFrom,
    numberTo: scene.numberTo,
    numberColor: scene.numberColor,
    zoomPunch: scene.zoomPunch,
    transition: scene.transition,
    background: scene.background,
    orientation,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).slice(0, 24);
}

// In-memory object URL cache so we don't refetch thumbs during a session.
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function SceneThumbnail({ scene }: { scene: Scene }) {
  const project = useProjectStore((s) => s.project);
  const characters = useAssetStore((s) => s.characters);
  const sfx = useAssetStore((s) => s.sfx);
  const orientation = getOrientation(project);

  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const key = sceneHash(scene, orientation);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const cached = urlCache.get(key);
    if (cached) {
      setUrl(cached);
      return;
    }
    const existing = inflight.get(key);
    if (existing) {
      existing.then(setUrl).catch(() => {});
      return;
    }

    const charMap: Record<string, string> = {};
    for (const c of characters) charMap[c.id] = c.src;
    const sfxMap: Record<string, string> = {};
    for (const s of sfx) sfxMap[s.id] = s.src;

    const p = fetch("/api/thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        width: project.width,
        height: project.height,
        fps: project.fps,
        characters: charMap,
        sfx: sfxMap,
        orientation,
        // 2x scale so retina screens don't see pixelated thumbnails;
        // the cache is content-addressed so we don't repaint per device.
        scale: 2,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`thumbnail failed ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        urlCache.set(key, objectUrl);
        return objectUrl;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, p);
    p.then(setUrl).catch(() => {});
  }, [visible, key, project.width, project.height, project.fps, orientation, scene, characters, sfx]);

  const isPortrait = orientation === "portrait";

  return (
    <div
      ref={ref}
      className={`shrink-0 overflow-hidden bg-neutral-800 rounded border border-neutral-700 ${
        isPortrait ? "w-6 h-10" : "w-12 h-7"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
      )}
    </div>
  );
}
