"use client";

import { useEffect, useState } from "react";
import { loadHyperframesPlayer } from "@/lib/hyperframes-player-loader";

type AspectRatio = "16:9" | "9:16" | "1:1";

// Fullscreen "zoom" viewer for a composition (live or a past version). Plays
// the hyperframes player large, with a rotate control so a landscape clip can
// be turned to fill a portrait phone (and vice-versa), plus tap-out / Esc.
export function VideoViewerModal({
  src,
  aspectRatio,
  onClose,
}: {
  src: string;
  aspectRatio: AspectRatio;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 or 90 degrees
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    loadHyperframesPlayer().then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Track viewport so the fit math (and rotation) stays correct on resize /
  // device-orientation change.
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    // Lock body scroll while the viewer is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const [arW, arH] = aspectRatio.split(":").map(Number);
  const ar = arW / arH;
  // Usable area (leave room for the toolbar + breathing space).
  const availW = (vp.w || 1) * 0.96;
  const availH = (vp.h || 1) * 0.84;

  let boxW: number;
  let boxH: number;
  if (rotation % 180 === 0) {
    boxW = Math.min(availW, availH * ar);
    boxH = boxW / ar;
  } else {
    // Rotated 90°: the player's pre-rotation footprint is height×width swapped,
    // so size it to fit the swapped bounds, then the rotation fills the screen.
    boxH = Math.min(availW, availH / ar);
    boxW = boxH * ar;
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
    >
      {/* Toolbar */}
      <div
        className="absolute right-3 top-3 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setRotation((r) => (r === 0 ? 90 : 0))}
          title="Rotate"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2 2l20 20M22 2L2 22" />
          </svg>
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden rounded-lg bg-black shadow-2xl transition-transform duration-200"
        style={{
          width: `${Math.round(boxW)}px`,
          height: `${Math.round(boxH)}px`,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {ready ? (
          // @ts-expect-error custom element
          <hyperframes-player
            src={src}
            controls
            autoplay
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            <span className="ml-2">Loading…</span>
          </div>
        )}
      </div>
    </div>
  );
}
