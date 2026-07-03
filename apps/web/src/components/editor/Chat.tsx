"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markEditSent } from "@/lib/preview-budget";
import { creditCostLabel } from "@/lib/billing/credit-costs";
import { AssetPickerModal } from "./AssetPickerModal";
import { VideoViewerModal } from "./VideoViewerModal";
import { ModelPicker } from "./chat/ModelPicker";
import { type AspectRatio, type ChatMessage, extractNextSteps } from "./chat/types";
import { useChatStream } from "./chat/useChatStream";
import { ActivityIndicator, LiveLog } from "./chat/LiveActivity";
import { MessageBubble, VideoMessageCard } from "./chat/MessageView";

const SAMPLE_PROMPTS: Array<{
  tag: string;
  ratio: "9:16" | "16:9";
  niche: string;
  prompt: string;
}> = [
  {
    tag: "Remove filler words",
    ratio: "16:9",
    niche: "youtube",
    prompt:
      "I just uploaded an interview clip. Transcribe it, find all the 'um', 'uh', and long pauses over 0.4s, cut them out cleanly on word boundaries, burn sync'd captions (2 words, uppercase, white pill), warm grade, −14 LUFS output.",
  },
  {
    tag: "Highlight reel",
    ratio: "9:16",
    niche: "shorts",
    prompt:
      "Turn the uploaded footage into a punchy 45-second highlight reel for Instagram Reels. Bold uppercase captions, tight cuts, no dead air, sync to the beat of the uploaded music track.",
  },
  {
    tag: "Auto captions",
    ratio: "9:16",
    niche: "shorts",
    prompt:
      "Transcribe the uploaded video and burn sync'd captions — 2 words at a time, all caps, white text with a semi-transparent black pill background. Export as 9:16 for TikTok.",
  },
  {
    tag: "YouTube intro",
    ratio: "16:9",
    niche: "youtube",
    prompt:
      "Make a 10-second 1920x1080 YouTube channel intro. Dark background, channel name 'NOVA' slams in with a light-speed trail effect, logo smash on beat. Cinematic and bold.",
  },
  {
    tag: "Wedding highlight",
    ratio: "16:9",
    niche: "wedding",
    prompt:
      "Edit the uploaded wedding footage into a 2-minute highlight reel. Warm cinematic grade, slow crossfades, mix in the uploaded music track, add title cards for each key moment — ceremony, first dance, speeches.",
  },
  {
    tag: "Tutorial cleanup",
    ratio: "16:9",
    niche: "education",
    prompt:
      "Clean up this screen-recording tutorial: cut the dead air and filler words, normalize audio to −14 LUFS, add an animated lower-third with my name and the topic, export 1080p.",
  },
  {
    tag: "Speed ramp",
    ratio: "9:16",
    niche: "content",
    prompt:
      "Take the uploaded clip and ramp speed to 3× during the slow parts, snapping back to 1× at the action moments. Drop a dramatic music hit at the slowest frame. Export 9:16.",
  },
  {
    tag: "Lower-third titles",
    ratio: "16:9",
    niche: "corporate",
    prompt:
      "Add animated lower-third name titles to each speaker segment in this interview. 'Jane Smith · CEO' fades in at the bottom-left — clean white text on a dark translucent bar. Corporate style.",
  },
];

type UserPrefs = {
  niche: string | null;
  formatPreference: string | null;
  onboardingCompleted: boolean;
};

type SlashCommand =
  | { kind: "action"; cmd: string; icon: string; label: string; desc: string }
  | { kind: "prompt"; cmd: string; icon: string; label: string; desc: string; text: string };

const SLASH_COMMANDS: SlashCommand[] = [
  {
    kind: "action",
    cmd: "/render",
    icon: "▶",
    label: "Render MP4",
    desc: "Start a render job (⌘R)",
  },
  {
    kind: "action",
    cmd: "/preview",
    icon: "⏯",
    label: "Play / Pause",
    desc: "Toggle preview playback (⌘P)",
  },
  {
    kind: "prompt",
    cmd: "/punchier",
    icon: "↑",
    label: "Punchier",
    desc: "Tighter timing, bigger impact",
    text: "Make it punchier — tighter timing on every scene, bigger impact on the title beat, snappier transitions.",
  },
  {
    kind: "prompt",
    cmd: "/slower",
    icon: "↓",
    label: "Slower",
    desc: "Longer holds, slower transitions",
    text: "Slow it down — longer holds on key beats, slower transitions, let each idea land before the next.",
  },
  {
    kind: "prompt",
    cmd: "/palette",
    icon: "◈",
    label: "New palette",
    desc: "Swap to a fresher color palette",
    text: "Try a different color palette — keep the structure, swap to something fresher that still fits the niche.",
  },
  {
    kind: "prompt",
    cmd: "/reformat",
    icon: "↕",
    label: "Reformat",
    desc: "Convert between 9:16 and 16:9",
    text: "Reformat this composition for the other aspect ratio (if 16:9 → convert to 9:16; if 9:16 → convert to 16:9).",
  },
  {
    kind: "prompt",
    cmd: "/thumbnail",
    icon: "◻",
    label: "Thumbnail",
    desc: "Design a CTR-optimized thumbnail",
    text: "Design a thumbnail for this composition using design_thumbnail. Optimize for CTR — bold title, high contrast, readable at small size.",
  },
  {
    kind: "prompt",
    cmd: "/dramatic",
    icon: "!",
    label: "More dramatic",
    desc: "Bigger reveals, deeper contrast",
    text: "Make it more dramatic — bigger reveals, deeper contrast, one extra hit-beat at the climax.",
  },
  { kind: "action", cmd: "/brand", icon: "✦", label: "Brand kit", desc: "Open brand kit settings" },
];

const REGENERATE_CHIPS: Array<{ label: string; prompt: string }> = [
  {
    label: "Punchier",
    prompt:
      "Make it punchier — tighter timing on every scene, bigger impact on the title beat, snappier transitions.",
  },
  {
    label: "Slower",
    prompt:
      "Slow it down — longer holds on key beats, slower transitions, let each idea land before the next.",
  },
  {
    label: "Different palette",
    prompt:
      "Try a different color palette — keep the structure, swap to something fresher that still fits the niche.",
  },
  {
    label: "Tighter cuts",
    prompt: "Cut every scene duration ~20% tighter. Same beats, faster pace.",
  },
  {
    label: "Less text",
    prompt:
      "Less text on screen — keep only the essential line per scene, let the visuals carry it.",
  },
  {
    label: "More dramatic",
    prompt:
      "Make it more dramatic — bigger reveals, deeper contrast, one extra hit-beat at the climax.",
  },
];

export function Chat({ projectId, reloadKey }: { projectId: string; reloadKey: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // Streaming state (busy / live tool log / live activity label) + the SSE
  // read loop live in the useChatStream hook; the thread UI here just consumes
  // them. The protocol degrades gracefully — see chat/useChatStream.ts.
  const { busy, live, activity, runStream, resumeStream } = useChatStream();
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const [attachedAssets, setAttachedAssets] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slashMenuActive, setSlashMenuActive] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelMode, setModelMode] = useState<"auto" | "manual">("auto");
  // When set, a fullscreen zoom viewer for a composition (live or a snapshot).
  const [viewer, setViewer] = useState<{ src: string; aspectRatio: AspectRatio } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<(text?: string) => void>(() => {});
  const loadHistoryRef = useRef<() => void>(() => {});

  // Load the saved model-selection mode so the composer chip reflects it.
  useEffect(() => {
    let active = true;
    fetch("/api/account/model-preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json?.preferences?.mode) setModelMode(json.preferences.mode);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Prefill the chat box with the project description captured at creation
  // (the unified "describe it" step). One-shot — cleared after reading.
  useEffect(() => {
    try {
      const key = `vibeedit:seed:${projectId}`;
      const seed = localStorage.getItem(key);
      if (seed) {
        setInput(seed);
        localStorage.removeItem(key);
      }
    } catch {
      // localStorage unavailable — skip
    }
  }, [projectId]);

  useEffect(() => {
    function onEditAt(event: Event) {
      const detail = (event as CustomEvent<{ timestamp: number }>).detail;
      if (!detail || typeof detail.timestamp !== "number") return;
      const seconds = Math.max(0, detail.timestamp);
      setEditingAt(seconds);
      const prefix = `Edit the scene at ${seconds.toFixed(1)}s — `;
      setInput((current) => (current.startsWith("Edit the scene at ") ? prefix : prefix + current));
      setTimeout(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(node.value.length, node.value.length);
      }, 0);
    }
    window.addEventListener("vibeedit:edit-at", onEditAt);

    function onEditAsset(event: Event) {
      const detail = (event as CustomEvent<{ path: string }>).detail;
      if (!detail || typeof detail.path !== "string") return;
      const prefix =
        detail.path === "the composition"
          ? "Edit the composition — "
          : `Edit \`${detail.path}\` — `;
      setInput((current) => (current.startsWith("Edit ") ? prefix : prefix + current));
      setTimeout(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(node.value.length, node.value.length);
        node.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 0);
    }
    window.addEventListener("vibeedit:edit-asset", onEditAsset);

    function onVariantPicked(event: Event) {
      const detail = (
        event as CustomEvent<{
          targetPath: string;
          variantNumber: number;
          sceneSlug: string;
        }>
      ).detail;
      if (!detail) return;
      // Auto-fire a follow-up so the agent knows the chosen variant is now
      // at the canonical path and can continue building / referencing it.
      sendRef.current(
        `I picked variant #${detail.variantNumber} for "${detail.sceneSlug}". The image is now available at \`${detail.targetPath}\`. Continue building / wiring it into the composition.`,
      );
    }
    window.addEventListener("vibeedit:variant-picked", onVariantPicked);

    function onSendPrompt(event: Event) {
      const detail = (event as CustomEvent<{ text: string }>).detail;
      if (!detail || typeof detail.text !== "string" || !detail.text.trim()) return;
      sendRef.current(detail.text);
    }
    window.addEventListener("vibeedit:send-prompt", onSendPrompt);

    return () => {
      window.removeEventListener("vibeedit:edit-at", onEditAt);
      window.removeEventListener("vibeedit:edit-asset", onEditAsset);
      window.removeEventListener("vibeedit:variant-picked", onVariantPicked);
      window.removeEventListener("vibeedit:send-prompt", onSendPrompt);
    };
  }, []);

  useEffect(() => {
    loadHistoryRef.current();
    // If an agent run for this project is still executing server-side (tab was
    // closed mid-build and reopened, or a second tab), reattach and show it
    // live — then reload history once it finishes so the saved result renders.
    let cancelled = false;
    resumeStream(projectId).then((attached) => {
      if (attached && !cancelled) loadHistoryRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, resumeStream]);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs);
  }, []);

  // Project aspect ratio — sizes the inline per-version snapshot players so
  // vertical (9:16) and square comps aren't letterboxed into 16:9 cards.
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ar = data?.project?.aspectRatio;
        if (ar === "16:9" || ar === "9:16" || ar === "1:1") setAspectRatio(ar);
      })
      .catch(() => {});
  }, [projectId]);

  // Auto-scroll the thread to the newest content — but only when the user is
  // already near the bottom, so reading earlier messages (or interacting with a
  // version) isn't interrupted. Always snaps to the bottom on first load.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      el.scrollTo({ top: el.scrollHeight });
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight });
  }, [messages, live]);

  function getFilteredCommands(inputVal: string): SlashCommand[] {
    const query = inputVal.slice(1).toLowerCase();
    if (!query) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) => c.cmd.slice(1).startsWith(query) || c.label.toLowerCase().includes(query),
    );
  }

  function executeSlashCommand(cmd: SlashCommand) {
    setSlashMenuActive(false);
    setInput("");
    if (cmd.kind === "action") {
      if (cmd.cmd === "/render") window.dispatchEvent(new CustomEvent("vibeedit:render"));
      else if (cmd.cmd === "/preview")
        window.dispatchEvent(new CustomEvent("vibeedit:toggle-play"));
      else if (cmd.cmd === "/brand") window.open("/app/settings/brand", "_blank");
    } else {
      sendRef.current(cmd.text);
    }
  }

  async function loadHistory() {
    const response = await fetch(`/api/projects/${projectId}/messages`);
    if (!response.ok) return;
    const data = (await response.json()) as { messages: ChatMessage[] };
    setMessages(data.messages || []);
  }
  loadHistoryRef.current = loadHistory;

  function toggleAttach(path: string) {
    setAttachedAssets((cur) =>
      cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path],
    );
  }
  function detachAsset(path: string) {
    setAttachedAssets((cur) => cur.filter((p) => p !== path));
  }

  async function dropFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/"),
    );
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("file", file);
      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) return;
      const data = (await response.json()) as { uploaded?: string[] };
      const uploaded = (data.uploaded || []).filter((path) => path.startsWith("assets/"));
      if (uploaded.length) {
        setAttachedAssets((current) => [...current, ...uploaded]);
        textareaRef.current?.focus();
      }
    } finally {
      setUploading(false);
    }
  }

  async function send(text?: string) {
    const userMessageRaw = (text ?? input).trim();
    const hasAttachments = attachedAssets.length > 0;
    if ((!userMessageRaw && !hasAttachments) || busy) return;
    const imageAssets = attachedAssets.filter((p) => /\.(jpe?g|png|gif|webp|svg)$/i.test(p));
    const videoAssets = attachedAssets.filter((p) => /\.(mp4|mov|webm|avi|mkv)$/i.test(p));
    const otherAssets = attachedAssets.filter(
      (p) => !imageAssets.includes(p) && !videoAssets.includes(p),
    );
    const parts: string[] = [];
    if (imageAssets.length) {
      parts.push(
        `Reference image${imageAssets.length > 1 ? "s" : ""} attached at: ${imageAssets.map((p) => `\`${p}\``).join(", ")}. Use ${imageAssets.length > 1 ? "them" : "it"} as visual reference (palette / composition / vibe).`,
      );
    }
    if (videoAssets.length) {
      parts.push(
        `Video file${videoAssets.length > 1 ? "s" : ""} uploaded at: ${videoAssets.map((p) => `\`${p}\``).join(", ")}. Run probe_clip + analyze_clip on ${videoAssets.length > 1 ? "each" : "it"} before editing.`,
      );
    }
    if (otherAssets.length) {
      parts.push(
        `File${otherAssets.length > 1 ? "s" : ""} uploaded at: ${otherAssets.map((p) => `\`${p}\``).join(", ")}.`,
      );
    }
    const attachmentNote = hasAttachments ? parts.join(" ") : "";
    const userMessage = hasAttachments
      ? `${userMessageRaw}${userMessageRaw ? "\n\n" : ""}${attachmentNote}`
      : userMessageRaw;
    setInput("");
    setEditingAt(null);
    setAttachedAssets([]);
    setSlashMenuActive(false);
    markEditSent();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // The hook owns busy/live/activity, the SSE read loop, and the
    // agent-status broadcasts. It returns false only when the request never
    // started, in which case there's nothing new to reload.
    const started = await runStream(projectId, userMessage);
    if (started) await loadHistory();
  }
  sendRef.current = send;

  const showSamples = messages.length === 0 && !busy;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showChips = !busy && lastAssistant !== undefined;
  // Context-aware follow-ups the agent suggested at the end of its last turn.
  // Falls back to the generic quick-edits when the agent didn't emit any.
  const nextSteps = extractNextSteps(lastAssistant);
  const chipItems =
    nextSteps.length > 0 ? nextSteps.map((s) => ({ label: s, prompt: s })) : REGENERATE_CHIPS;

  // Per-version inline players. Each assistant turn that changed the composition
  // carries a snapshotId; we number them chronologically and render a click-to-
  // play card under every past version. The newest version is excluded here —
  // it's shown live in the always-on stage at the bottom of the thread.
  const versionMessages = messages.filter((m) => m.role === "assistant" && m.snapshotId);
  const versionNumberById = new Map<string, number>();
  versionMessages.forEach((m, i) => versionNumberById.set(m.snapshotId as string, i + 1));
  const latestSnapshotId =
    versionMessages.length > 0
      ? (versionMessages[versionMessages.length - 1].snapshotId as string)
      : null;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(false);
        dropFiles(event.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-bg)]/85 text-sm font-semibold text-[var(--color-accent)]">
          Drop image, video, or audio to attach
        </div>
      )}
      {showAssetPicker && (
        <AssetPickerModal
          projectId={projectId}
          attached={attachedAssets}
          onToggleAttach={toggleAttach}
          onDetach={detachAsset}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
      {viewer && (
        <VideoViewerModal
          src={viewer.src}
          aspectRatio={viewer.aspectRatio}
          onClose={() => setViewer(null)}
        />
      )}
      {showModelPicker && (
        <ModelPicker
          onClose={() => setShowModelPicker(false)}
          onModeChange={(mode) => setModelMode(mode)}
        />
      )}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${busy ? "animate-ping bg-[var(--color-accent)] opacity-75" : "bg-[var(--color-fg-subtle)]"}`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${busy ? "bg-[var(--color-accent)]" : "bg-[var(--color-fg-subtle)]"}`}
            />
          </span>
          <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
            {busy ? "Agent working…" : "Agent"}
          </span>
        </div>
        {editingAt !== null && (
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-2.5 py-1 text-[10px] font-medium text-[var(--color-accent)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            Editing @ {editingAt.toFixed(1)}s
            <button
              onClick={() => {
                setEditingAt(null);
                setInput((current) => (current.startsWith("Edit the scene at ") ? "" : current));
              }}
              className="ml-0.5 text-[var(--color-accent)]/60 hover:text-[var(--color-accent)]"
              title="Clear edit-at frame"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl space-y-2">
          {showSamples && <SamplePromptCards prefs={prefs} onPick={(text) => send(text)} />}
          {messages.map((message, index) => {
            const versionSnapshotId = message.role === "assistant" ? message.snapshotId : null;
            const isLatestVersion = !!versionSnapshotId && versionSnapshotId === latestSnapshotId;
            return (
              <div key={message.id || index} className="space-y-2">
                <MessageBubble
                  message={message}
                  projectId={projectId}
                  onBranched={(newProjectId) => router.push(`/app/projects/${newProjectId}/edit`)}
                />
                {versionSnapshotId && (
                  <VideoMessageCard
                    label={
                      isLatestVersion
                        ? "Latest preview"
                        : `Version ${versionNumberById.get(versionSnapshotId) ?? 0}`
                    }
                    aspectRatio={aspectRatio}
                    onOpen={() =>
                      setViewer({
                        src: isLatestVersion
                          ? `/api/projects/${projectId}/files/index.html?v=${reloadKey}`
                          : `/api/projects/${projectId}/snapshots/${versionSnapshotId}/html`,
                        aspectRatio,
                      })
                    }
                  />
                )}
              </div>
            );
          })}
          {(live.length > 0 || activity) && (
            <div className="max-w-[90%] space-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs shadow-sm">
              <ActivityIndicator label={activity} />
              <LiveLog live={live} projectId={projectId} />
            </div>
          )}
        </div>
      </div>

      {showChips && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              {nextSteps.length > 0 ? "Suggested next steps" : "Quick edits"}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chipItems.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => send(chip.prompt)}
                  className="shrink-0 whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 sm:p-3">
        <div className="mx-auto w-full max-w-3xl">
          {(attachedAssets.length > 0 || uploading) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedAssets.map((path) => (
                <span
                  key={path}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg)]"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.34a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {path.replace(/^assets\//, "")}
                  <button
                    onClick={() =>
                      setAttachedAssets((current) => current.filter((p) => p !== path))
                    }
                    className="text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-fg-muted)]">
                  <span className="inline-block h-2 w-2 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                  uploading…
                </span>
              )}
            </div>
          )}
          <div className="relative">
            {slashMenuActive && (
              <SlashCommandMenu
                input={input}
                selectedIndex={slashMenuIndex}
                onSelect={executeSlashCommand}
                getFiltered={getFilteredCommands}
              />
            )}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-2)] transition-colors focus-within:border-[var(--color-accent)]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  const value = event.target.value;
                  setInput(value);
                  if (value.startsWith("/") && !busy) {
                    setSlashMenuActive(true);
                    setSlashMenuIndex(0);
                  } else if (slashMenuActive) {
                    setSlashMenuActive(false);
                  }
                }}
                onKeyDown={(event) => {
                  if (slashMenuActive) {
                    const filtered = getFilteredCommands(input);
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setSlashMenuIndex((i) => (i + 1) % Math.max(filtered.length, 1));
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setSlashMenuIndex(
                        (i) =>
                          (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
                      );
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSlashMenuActive(false);
                      return;
                    }
                    if (event.key === "Tab") {
                      event.preventDefault();
                      const cmd = filtered[slashMenuIndex];
                      if (cmd) {
                        setInput(cmd.cmd + " ");
                        setSlashMenuActive(false);
                      }
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey && filtered.length > 0) {
                      event.preventDefault();
                      executeSlashCommand(filtered[Math.min(slashMenuIndex, filtered.length - 1)]);
                      return;
                    }
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Describe the video — or type / for commands…"
                rows={2}
                disabled={busy}
                className="max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-base text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] disabled:opacity-50 md:text-sm"
              />
              <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
                <div className="flex items-center gap-0.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files?.length) dropFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || uploading}
                    title="Attach an image, video, or audio file"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] disabled:opacity-50"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.34a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAssetPicker(true)}
                    title="Browse your uploaded files"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModelPicker(true)}
                    title="Choose which AI models generate your assets"
                    className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" />
                      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
                    </svg>
                    {modelMode === "manual" ? "Custom models" : "Auto"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-medium text-[var(--color-fg-subtle)]"
                    title="Each AI edit request costs credits. Renders and generations cost extra — the agent will estimate before spending."
                  >
                    {creditCostLabel("edit")}
                  </span>
                  {busy ? (
                    <button
                      onClick={() => {
                        fetch(`/api/chat?projectId=${projectId}`, { method: "DELETE" }).catch(
                          () => {},
                        );
                      }}
                      title="Stop agent"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/25"
                    >
                      <span className="h-3 w-3 rounded-[2px] bg-current" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      onClick={() => send()}
                      disabled={!input.trim() && attachedAssets.length === 0}
                      title="Send"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 hidden text-center text-[9px] text-[var(--color-fg-subtle)] sm:block">
            ↵ send · ⇧↵ newline · drag image/video to attach · / for commands
          </p>
        </div>
      </div>
    </div>
  );
}

const GUIDE_KEY = "vibeedit:guide-seen";

const GUIDE_STEPS = [
  { icon: "✏️", title: "Describe it", sub: "Type what you want in plain English" },
  { icon: "⚙️", title: "Watch it build", sub: "Agent writes every scene automatically" },
  { icon: "▶️", title: "Render & export", sub: "Hit Render MP4 when you're happy" },
];

function FirstVisitGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(GUIDE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(GUIDE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          How it works
        </span>
        <button
          onClick={dismiss}
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          title="Dismiss"
          aria-label="Dismiss guide"
          onKeyDown={(event) => event.key === "Enter" && dismiss()}
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {GUIDE_STEPS.map((step, i) => (
          <div key={step.title} className="rounded-lg bg-[var(--color-bg-2)] p-2">
            <div className="mb-1.5 text-base">{step.icon}</div>
            <div className="text-[11px] font-semibold text-[var(--color-fg)]">{step.title}</div>
            <div className="mt-0.5 text-[9px] leading-snug text-[var(--color-fg-muted)]">
              {step.sub}
            </div>
            <div className="mt-1.5 text-[9px] font-bold text-[var(--color-accent)]/60">{i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SamplePromptCards({
  prefs,
  onPick,
}: {
  prefs: UserPrefs | null;
  onPick: (text: string) => void;
}) {
  const ordered = orderForPrefs(SAMPLE_PROMPTS, prefs);
  return (
    <div className="space-y-3">
      <FirstVisitGuide />
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        {prefs?.niche ? `Picks for ${humanNiche(prefs.niche)}` : "Start with a prompt"}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {ordered.map((sample) => (
          <button
            key={sample.tag}
            onClick={() => onPick(sample.prompt)}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-all hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)]"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
                {sample.tag}
              </span>
              <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-fg-muted)]">
                {sample.ratio}
              </span>
            </div>
            <div className="line-clamp-2 text-[11px] leading-snug text-[var(--color-fg-muted)]">
              {sample.prompt}
            </div>
          </button>
        ))}
      </div>
      <div className="pt-1 text-center text-[9px] text-[var(--color-fg-subtle)]">
        or type your own prompt below
      </div>
    </div>
  );
}

function orderForPrefs(
  samples: typeof SAMPLE_PROMPTS,
  prefs: UserPrefs | null,
): typeof SAMPLE_PROMPTS {
  if (!prefs) return samples;
  const scored = samples
    .map((sample) => {
      let score = 0;
      if (prefs.niche && prefs.niche === sample.niche) score += 10;
      if (prefs.formatPreference === sample.ratio) score += 5;
      if (prefs.formatPreference === "both") score += 1;
      return { sample, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.sample);
}

function humanNiche(niche: string): string {
  const map: Record<string, string> = {
    youtube: "YouTube",
    shorts: "Shorts / Reels",
    wedding: "weddings & events",
    corporate: "corporate & brand",
    education: "tutorials",
    documentary: "documentary & film",
    content: "content creation",
    other: "your workflow",
  };
  return map[niche] || "your workflow";
}
function SlashCommandMenu({
  input,
  selectedIndex,
  onSelect,
  getFiltered,
}: {
  input: string;
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  getFiltered: (inputVal: string) => SlashCommand[];
}) {
  const filtered = getFiltered(input);
  if (filtered.length === 0) return null;
  return (
    <div
      className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="border-b border-[var(--color-border)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        Commands
      </div>
      {filtered.map((cmd, index) => (
        <button
          key={cmd.cmd}
          onClick={() => onSelect(cmd)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
            index === selectedIndex
              ? "bg-[var(--color-accent)]/10 text-[var(--color-fg)]"
              : "hover:bg-[var(--color-bg-2)]"
          }`}
        >
          <span className="w-4 shrink-0 text-center text-sm text-[var(--color-accent)]">
            {cmd.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[var(--color-fg)]">{cmd.label}</span>
            <span className="ml-2 text-[10px] text-[var(--color-fg-muted)]">{cmd.desc}</span>
          </span>
          <kbd className="shrink-0 rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-fg-subtle)]">
            {cmd.cmd}
          </kbd>
        </button>
      ))}
      <div className="border-t border-[var(--color-border)] px-3 py-1.5 text-[9px] text-[var(--color-fg-subtle)]">
        ↑↓ navigate · ↵ run · Tab complete · Esc close
      </div>
    </div>
  );
}
