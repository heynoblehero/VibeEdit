import { ImageResponse } from "next/og";

export const runtime = "edge";

// Branded, dynamic Open Graph card. Driven by query params so every marketing /
// share / showcase surface can render its own card:
//   /og?title=...&subtitle=...&badge=...
// Falls back to the default brand card when no params are supplied.
const BG = "#070709";
const FG = "#eeeef2";
const MUTED = "#8888a0";
const ACCENT = "#d4ff3a";
const BORDER = "#1e1e2c";

function clamp(value: string | null, max: number): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = clamp(searchParams.get("title"), 90) || "Claude Code for Video";
  const subtitle =
    clamp(searchParams.get("subtitle"), 120) ||
    "Prompt an AI. It writes the video. Renders to MP4 in minutes.";
  const badge = clamp(searchParams.get("badge"), 28) || "vibeedit.video";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        backgroundImage: `radial-gradient(circle at 78% 18%, ${ACCENT}1f 0%, transparent 42%)`,
        padding: "72px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          V
        </div>
        <div style={{ color: FG, fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
          VibeEdit
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 10,
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            padding: "8px 18px",
            color: MUTED,
            fontSize: 22,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: ACCENT }} />
          {badge}
        </div>
        <div
          style={{
            color: FG,
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ color: MUTED, fontSize: 32, lineHeight: 1.3, maxWidth: 920 }}>{subtitle}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 24 }}>
        <span>Describe the video. Get the MP4.</span>
        <span style={{ color: ACCENT, fontWeight: 700 }}>vibeedit.video</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
