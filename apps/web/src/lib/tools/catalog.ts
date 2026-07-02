// The free-tools lineup. Each is a standalone, no-signup marketing/SEO surface
// that funnels to sign-up. `live` tools have a working page; `soon` are the
// planned roadmap (rendered as "coming soon" on the hub). All reuse our ffmpeg /
// ElevenLabs stack.

export type FreeTool = {
  slug: string;
  name: string;
  tagline: string;
  status: "live" | "soon";
  // How it's built (for the roadmap / when we implement it).
  tech: string;
};

export const FREE_TOOLS: FreeTool[] = [
  {
    slug: "watermark-remover",
    name: "AI Video Watermark Remover",
    tagline: "Remove the Veo / AI watermark from videos you generated. Free, no signup.",
    status: "live",
    tech: "ffmpeg delogo (V1) → reverse-alpha for near-lossless (V2)",
  },
  {
    slug: "video-compressor",
    name: "Video Compressor",
    tagline:
      "Shrink a video's file size for email, Discord, or the web — without wrecking quality.",
    status: "soon",
    tech: "ffmpeg libx264 crf sweep + scale cap",
  },
  {
    slug: "video-converter",
    name: "Video Converter",
    tagline: "MP4, MOV, WebM, GIF — convert between formats in seconds.",
    status: "soon",
    tech: "ffmpeg transcode / palettegen for GIF",
  },
  {
    slug: "background-noise-remover",
    name: "Background Noise Remover",
    tagline: "Isolate the voice and kill the background noise in any clip.",
    status: "soon",
    tech: "ElevenLabs Audio Isolation (already built as an agent tool) + anlmdn fallback",
  },
  {
    slug: "silence-remover",
    name: "Silence Remover",
    tagline: "Auto-cut dead air and long pauses to tighten up your video.",
    status: "soon",
    tech: "ffmpeg silencedetect + cut/concat (reuses our EDL primitives)",
  },
  {
    slug: "auto-subtitles",
    name: "Auto Subtitle Generator",
    tagline: "AI-transcribed captions, burned straight into your video.",
    status: "soon",
    tech: "ElevenLabs Scribe STT → SRT → ffmpeg subtitles (reuses transcribe + burn)",
  },
  {
    slug: "video-resizer",
    name: "Video Resizer / Reframer",
    tagline: "Reframe 16:9 ↔ 9:16 ↔ 1:1 for any platform, with a blurred fill.",
    status: "soon",
    tech: "ffmpeg scale + blurred-cover background composite",
  },
  {
    slug: "audio-extractor",
    name: "Audio Extractor",
    tagline: "Pull a clean MP3 out of any video.",
    status: "soon",
    tech: "ffmpeg -vn (reuses extractAudio)",
  },
];

export function liveTools(): FreeTool[] {
  return FREE_TOOLS.filter((t) => t.status === "live");
}
