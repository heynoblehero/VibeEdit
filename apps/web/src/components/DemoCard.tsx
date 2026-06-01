"use client";

import { useRef, useEffect, useState } from "react";

type Props = {
  demoFile: string;
  projectName: string;
  channelName: string;
  platform: string;
  aspectRatio: "9:16" | "16:9";
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

// Native composition dimensions
const COMP_W: Record<"9:16" | "16:9", number> = { "9:16": 1080, "16:9": 1920 };
const COMP_H: Record<"9:16" | "16:9", number> = { "9:16": 1920, "16:9": 1080 };

export function DemoCard({ demoFile, projectName, channelName, platform, aspectRatio }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const isVertical = aspectRatio === "9:16";
  const compW = COMP_W[aspectRatio];
  const compH = COMP_H[aspectRatio];

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setScale(width / compW);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [compW]);

  const platformLabel = PLATFORM_LABELS[platform] ?? platform;

  return (
    <div className="group block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:border-[var(--color-accent)]/40 hover:shadow-xl">
      {/* Scaled iframe container */}
      <div
        ref={wrapRef}
        className={`relative overflow-hidden ${isVertical ? "aspect-[9/16]" : "aspect-video"}`}
      >
        {scale > 0 && (
          <iframe
            src={`/demos/${demoFile}`}
            title={projectName}
            style={{
              width: compW,
              height: compH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: "none",
              pointerEvents: "none",
              display: "block",
            }}
            loading="lazy"
          />
        )}

        {/* Gradient overlay */}
        {isVertical && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        )}

        {/* Platform badge */}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
          {platformLabel}
        </span>

        {/* Name overlaid at bottom for vertical cards */}
        {isVertical && (
          <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow-sm">
              {projectName}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/55">{channelName}</p>
          </div>
        )}
      </div>

      {/* Meta row for landscape */}
      {!isVertical && (
        <div className="p-3">
          <p className="truncate text-xs font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
            {projectName}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--color-fg-subtle)]">{channelName}</p>
        </div>
      )}
    </div>
  );
}
