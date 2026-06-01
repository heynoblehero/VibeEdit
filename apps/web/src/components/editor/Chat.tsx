"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markEditSent } from "@/lib/preview-budget";

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content?: string;
      images?: Array<{ data: string; mimeType: string }>;
    };

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
  | {
      type: "tool_result";
      tool_use_id: string;
      result: string;
      images?: Array<{ data: string; mimeType: string }>;
    }
  | { type: "turn_end"; usage?: Record<string, unknown> }
  | { type: "done"; stop_reason: string }
  | { type: "error"; message: string };

type VariantInfo = {
  sceneSlug: string;
  dir: string;
  targetPath: string;
  paths: string[];
};

type LiveEntry =
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      name: string;
      inputSummary: string;
      input?: Record<string, unknown>;
      result?: string;
      images?: Array<{ data: string; mimeType: string }>;
      variants?: VariantInfo;
      prevContent?: string;
    }
  | { kind: "error"; message: string };

function extractVariants(result: string): VariantInfo | null {
  const match = result.match(/<variants>([\s\S]*?)<\/variants>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as VariantInfo;
    if (
      !parsed ||
      typeof parsed.sceneSlug !== "string" ||
      typeof parsed.targetPath !== "string" ||
      !Array.isArray(parsed.paths) ||
      parsed.paths.length === 0
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

const SAMPLE_PROMPTS: Array<{
  tag: string;
  ratio: "9:16" | "16:9";
  niche: string;
  prompt: string;
}> = [
  {
    tag: "Comic-style hook",
    ratio: "16:9",
    niche: "comic",
    prompt:
      "Make a 30-second 1920x1080 comic-book facts hook. Red + yellow palette, bold Anton type, a glass-crack hit at the 0s smash, halftone backdrop, and a corner-stamp number. End on a 'watch part 2' CTA. Generic comic energy — no real publishers or characters.",
  },
  {
    tag: "Anime-style Short",
    ratio: "9:16",
    niche: "anime",
    prompt:
      "Make a 30-second 1080x1920 anime facts Short. Pink + cyan chromatic palette, speed-line backdrop, tilted kicker text, big chromatic-split title, scale-pulse on the title. Generic anime energy — no real series or characters.",
  },
  {
    tag: "60s history Short",
    ratio: "9:16",
    niche: "history",
    prompt:
      "Make a 60-second 1080x1920 vertical history Short about the ancient pyramids. Sepia palette, serif title type, slow ken-burns backgrounds, no flashes. End with a question that hooks the next video.",
  },
  {
    tag: "Finance long-form intro",
    ratio: "16:9",
    niche: "finance",
    prompt:
      "Make a 20-second 1920x1080 intro for a finance long-form video. Black + neon-green palette, big animated counters, a sharp line chart drawing in, scanline overlay.",
  },
  {
    tag: "Scary story Short",
    ratio: "9:16",
    niche: "scary",
    prompt:
      "Make a 45-second 1080x1920 scary story Short. Deep blue/purple gradient, slow fades only, candle-flicker grain. Soft serif title 'THE BASEMENT TAPE' that pulses.",
  },
  {
    tag: "Tech tutorial intro",
    ratio: "16:9",
    niche: "tech",
    prompt:
      "Make a 15-second 1920x1080 tutorial intro for a coding channel. Dark gray + cyan accent, monospace type, three rotating code snippets, end on the channel name 'devloop'.",
  },
  {
    tag: "Sleep-story long-form",
    ratio: "16:9",
    niche: "sleep",
    prompt:
      "Make a 30-second 1920x1080 calm sleep-story intro. Indigo gradient, very slow ken-burns, soft serif type, no FX. Title: 'Ancient Stars'. Should feel peaceful.",
  },
  {
    tag: "Sci-fi declassified Short",
    ratio: "9:16",
    niche: "scifi",
    prompt:
      "Make a 30-second 1080x1920 sci-fi 'declassified file' Short. Cyan-on-black, grid + scanlines, JetBrains Mono for tags, glowing case-file number that pulses. Ominous.",
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

export function Chat({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const [attachedAssets, setAttachedAssets] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slashMenuActive, setSlashMenuActive] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<(text?: string) => void>(() => {});
  const loadHistoryRef = useRef<() => void>(() => {});
  const fileHistoryRef = useRef<Map<string, string>>(new Map());

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

    return () => {
      window.removeEventListener("vibeedit:edit-at", onEditAt);
      window.removeEventListener("vibeedit:edit-asset", onEditAsset);
      window.removeEventListener("vibeedit:variant-picked", onVariantPicked);
    };
  }, []);

  useEffect(() => {
    loadHistoryRef.current();
  }, [projectId]);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
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

  async function dropFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
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
    const attachmentNote = hasAttachments
      ? `Reference image${attachedAssets.length > 1 ? "s" : ""} attached at: ${attachedAssets
          .map((path) => `\`${path}\``)
          .join(
            ", ",
          )}. Use ${attachedAssets.length > 1 ? "them" : "it"} as visual reference (palette / composition / vibe).`
      : "";
    const userMessage = hasAttachments
      ? `${userMessageRaw}${userMessageRaw ? "\n\n" : ""}${attachmentNote}`
      : userMessageRaw;
    setInput("");
    setEditingAt(null);
    setAttachedAssets([]);
    setSlashMenuActive(false);
    setBusy(true);
    setLive([]);
    markEditSent();
    window.dispatchEvent(
      new CustomEvent("vibeedit:agent-status", {
        detail: { working: true, label: "thinking" },
      }),
    );
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    const { getAllApiKeys } = await import("@/lib/api-keys/store");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        message: userMessage,
        apiKeys: getAllApiKeys(),
      }),
    });
    if (!response.ok || !response.body) {
      setLive([{ kind: "error", message: `error: ${response.statusText}` }]);
      setBusy(false);
      window.dispatchEvent(
        new CustomEvent("vibeedit:agent-status", {
          detail: { working: false },
        }),
      );
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    // Cap the inter-chunk buffer so a misbehaving server can't push us
    // into unbounded memory by streaming without a terminator. 1 MiB is
    // already 10× larger than any legitimate single SSE frame here.
    const MAX_BUFFER = 1024 * 1024;
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_BUFFER) {
        buffer = buffer.slice(-MAX_BUFFER);
      }
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const block of lines) {
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as AgentEvent;
          handleEvent(event);
        } catch {
          /* ignore */
        }
      }
    }
    setBusy(false);
    setLive([]);
    window.dispatchEvent(
      new CustomEvent("vibeedit:agent-status", {
        detail: { working: false },
      }),
    );
    await loadHistory();
  }
  sendRef.current = send;

  function handleEvent(event: AgentEvent) {
    if (event.type === "text") {
      setLive((l) => [...l, { kind: "text", text: event.text }]);
    } else if (event.type === "tool_use") {
      window.dispatchEvent(
        new CustomEvent("vibeedit:agent-status", {
          detail: { working: true, label: event.name },
        }),
      );
      let prevContent: string | undefined;
      if (
        event.name === "write_file" &&
        typeof event.input.path === "string" &&
        typeof event.input.content === "string"
      ) {
        prevContent = fileHistoryRef.current.get(event.input.path);
        fileHistoryRef.current.set(event.input.path, event.input.content as string);
      }
      setLive((l) => [
        ...l,
        {
          kind: "tool",
          name: event.name,
          inputSummary: summarizeToolInput(event.name, event.input),
          input: event.input,
          prevContent,
        },
      ]);
    } else if (event.type === "tool_result") {
      setLive((l) => {
        const next = [...l];
        for (let i = next.length - 1; i >= 0; i--) {
          const entry = next[i];
          if (entry.kind === "tool" && !entry.result) {
            const variants = extractVariants(event.result);
            next[i] = {
              ...entry,
              result: truncate(event.result, 240),
              images: event.images,
              variants: variants || undefined,
            };
            return next;
          }
        }
        return next;
      });
    } else if (event.type === "error") {
      setLive((l) => [...l, { kind: "error", message: event.message }]);
    }
  }

  const showSamples = messages.length === 0 && !busy;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showChips = !busy && lastAssistant !== undefined;

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
          Drop image to attach as reference
        </div>
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

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {showSamples && <SamplePromptCards prefs={prefs} onPick={(text) => send(text)} />}
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id || index}
            message={message}
            projectId={projectId}
            onBranched={(newProjectId) => router.push(`/app/projects/${newProjectId}/edit`)}
          />
        ))}
        {live.length > 0 && (
          <div className="max-w-[90%] space-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs shadow-sm">
            {groupLive(live).map((entry, i) =>
              entry.kind === "buildGroup" ? (
                <BuildGroupView key={i} entries={entry.entries} projectId={projectId} />
              ) : (
                <LiveLine key={i} entry={entry} projectId={projectId} />
              ),
            )}
          </div>
        )}
      </div>

      {showChips && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Quick edits
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REGENERATE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => send(chip.prompt)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
                  onClick={() => setAttachedAssets((current) => current.filter((p) => p !== path))}
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
                    (i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
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
            rows={3}
            disabled={busy}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] disabled:opacity-50"
          />
        </div>
        {busy ? (
          <button
            onClick={() => {
              fetch(`/api/chat?projectId=${projectId}`, { method: "DELETE" }).catch(() => {});
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 py-2.5 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/14"
          >
            <span className="inline-block h-3 w-3 rounded-sm bg-current" aria-hidden="true" />
            Stop agent
          </button>
        ) : (
          <button
            onClick={() => send()}
            disabled={!input.trim() && attachedAssets.length === 0}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Send
            <kbd className="rounded bg-black/15 px-1 py-0.5 font-mono text-[9px] font-normal">
              ↵
            </kbd>
          </button>
        )}
        <p className="mt-2 text-center text-[9px] text-[var(--color-fg-subtle)]">
          ↵ send · ⇧↵ newline · drag image to attach · / for commands
        </p>
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
    comic: "comic / superhero",
    anime: "anime / manga",
    scifi: "sci-fi / mystery",
    history: "history",
    finance: "finance",
    sleep: "sleep stories",
    scary: "scary stories",
    tech: "tech / coding",
    other: "your channel",
  };
  return map[niche] || "your channel";
}

function LiveLine({ entry, projectId }: { entry: LiveEntry; projectId?: string }) {
  if (entry.kind === "text") {
    return <div className="text-[var(--color-fg)]">{entry.text}</div>;
  }
  if (entry.kind === "error") {
    return <div className="text-[var(--color-danger)]">× {entry.message}</div>;
  }
  if (entry.name === "plan_composition" && entry.input) {
    return <PlanCard input={entry.input} />;
  }
  if (entry.name === "write_file" && entry.input) {
    const isFileDone = !!entry.result;
    if (isFileDone) {
      return (
        <ToolUseBubble name={entry.name} input={entry.input} prevContent={entry.prevContent} />
      );
    }
    const writePath = typeof entry.input.path === "string" ? entry.input.path : "";
    return (
      <div className="font-mono text-[var(--color-fg-muted)]">
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
          aria-label="running"
        />{" "}
        <span className="text-[var(--color-fg)]">write_file</span>
        {writePath && <span> ({writePath})</span>}
      </div>
    );
  }
  const isDone = !!entry.result;
  return (
    <div className="font-mono text-[var(--color-fg-muted)]">
      {isDone ? (
        <span className="text-[var(--color-success)]">✓</span>
      ) : (
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
          aria-label="running"
        />
      )}{" "}
      <span className="text-[var(--color-fg)]">{entry.name}</span>
      {entry.inputSummary && (
        <span className="text-[var(--color-fg-muted)]">({entry.inputSummary})</span>
      )}
      {entry.result && !entry.variants && (
        <>
          <div className="mt-0.5 ml-3 truncate text-[10px] text-[var(--color-fg-muted)]">
            {entry.result}
          </div>
          <ApiKeyErrorCard result={entry.result} />
        </>
      )}
      {entry.images && entry.images.length > 0 && <ScreenshotStrip images={entry.images} />}
      {entry.variants && projectId && <VariantPicker info={entry.variants} projectId={projectId} />}
    </div>
  );
}

function VariantPicker({ info, projectId }: { info: VariantInfo; projectId: string }) {
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(index: number) {
    if (promoting || chosenIndex !== null) return;
    setPromoting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/variants/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variantPath: info.paths[index],
          targetPath: info.targetPath,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setChosenIndex(index);
      // Auto-send a follow-up to the agent so it knows which variant to use.
      window.dispatchEvent(
        new CustomEvent("vibeedit:variant-picked", {
          detail: {
            targetPath: info.targetPath,
            variantNumber: index + 1,
            sceneSlug: info.sceneSlug,
          },
        }),
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-3 font-sans">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Pick one — variants for {info.sceneSlug}
        </div>
        {chosenIndex !== null && (
          <span className="text-[10px] text-[var(--color-success)]">
            ✓ Using #{chosenIndex + 1}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {info.paths.map((path, index) => {
          const url = `/api/projects/${projectId}/files/${path}`;
          const isChosen = chosenIndex === index;
          return (
            <button
              key={path}
              onClick={() => pick(index)}
              disabled={promoting || chosenIndex !== null}
              className={`group relative aspect-video overflow-hidden rounded-md border transition-all ${
                isChosen
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
              } ${promoting || chosenIndex !== null ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <img src={url} alt={`Variant ${index + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                #{index + 1}
              </span>
              {isChosen && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-accent)]/30">
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-1 text-xs font-bold text-black">
                    ✓
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {error && <div className="mt-2 text-xs text-[var(--color-danger)]">{error}</div>}
      {chosenIndex === null && !promoting && (
        <div className="mt-2 text-[11px] text-[var(--color-fg-muted)]">
          Click any variant to make it the scene background. Others stay in{" "}
          <code className="rounded bg-[var(--color-bg)] px-1">{info.dir}</code>.
        </div>
      )}
    </div>
  );
}

const BUILD_STEP_NAMES = new Set([
  "write_file",
  "diff_file",
  "lint_composition",
  "screenshot_at_time",
]);

type GroupedLive =
  | LiveEntry
  | {
      kind: "buildGroup";
      entries: Extract<LiveEntry, { kind: "tool" }>[];
    };

function groupLive(entries: LiveEntry[]): GroupedLive[] {
  const result: GroupedLive[] = [];
  let buffer: Extract<LiveEntry, { kind: "tool" }>[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    if (buffer.length === 1) result.push(buffer[0]);
    else result.push({ kind: "buildGroup", entries: buffer });
    buffer = [];
  };
  for (const entry of entries) {
    if (entry.kind === "tool" && BUILD_STEP_NAMES.has(entry.name)) {
      buffer.push(entry);
    } else {
      flush();
      result.push(entry);
    }
  }
  flush();
  return result;
}

function BuildGroupView({
  entries,
  projectId,
}: {
  entries: Extract<LiveEntry, { kind: "tool" }>[];
  projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const allDone = entries.every((entry) => !!entry.result);
  const images = entries.flatMap((entry) => entry.images || []);
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-mono">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
      >
        <span>
          {allDone ? (
            <span className="text-[var(--color-success)]">✓</span>
          ) : (
            <span
              className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
              aria-label="running"
            />
          )}{" "}
          <span className="text-[var(--color-fg)]">{allDone ? "Built it" : "Building…"}</span>
          <span className="text-[var(--color-fg-muted)]">
            {" "}
            · {entries.length} step{entries.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-[var(--color-fg-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1.5">
          {entries.map((entry, i) => (
            <LiveLine key={i} entry={entry} projectId={projectId} />
          ))}
        </div>
      )}
      {images.length > 0 && <ScreenshotStrip images={images} />}
    </div>
  );
}

function ScreenshotStrip({ images }: { images: Array<{ data: string; mimeType: string }> }) {
  return (
    <div className="mt-2 ml-3 flex flex-wrap gap-1.5">
      {images.map((image, index) => (
        <img
          // eslint-disable-next-line @next/next/no-img-element
          key={index}
          src={`data:${image.mimeType};base64,${image.data}`}
          alt={`Screenshot ${index + 1}`}
          className="max-h-32 rounded border border-[var(--color-border)]"
        />
      ))}
    </div>
  );
}

const API_KEY_ERROR_RE = /no ([\w][\w\s\-/]*?) api key/i;

function ApiKeyErrorCard({ result }: { result: string }) {
  const match = result.match(API_KEY_ERROR_RE);
  if (!match) return null;
  const service = match[1].trim();
  return (
    <a
      href="/app/settings/api-keys"
      className="mt-1.5 ml-3 flex items-center gap-2 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-2.5 py-1.5 text-xs font-sans no-underline hover:bg-[var(--color-accent)]/10"
    >
      <span className="text-[var(--color-accent)]">⚠</span>
      <span className="text-[var(--color-fg)]">No {service} API key set</span>
      <span className="ml-auto shrink-0 text-[var(--color-accent)]">Add in Settings →</span>
    </a>
  );
}

function MessageBubble({
  message,
  projectId,
  onBranched,
}: {
  message: ChatMessage;
  projectId: string;
  onBranched: (newProjectId: string) => void;
}) {
  if (message.role === "user") {
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("\n");
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm text-[var(--color-fg)]">
        {text}
      </div>
    );
  }
  if (typeof message.content === "string") {
    return (
      <div className="group max-w-[88%] rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-relaxed">
        {message.content}
        <ForkFromHere projectId={projectId} messageId={message.id} onBranched={onBranched} />
      </div>
    );
  }
  const grouped = groupContentBlocks(message.content);
  return (
    <div className="group max-w-[88%] space-y-2 rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm">
      {grouped.map((item, i) => {
        if (item.kind === "text") {
          return (
            <div key={i} className="whitespace-pre-wrap">
              {item.text}
            </div>
          );
        }
        if (item.kind === "tool_use") {
          return <ToolUseBubble key={i} name={item.name} input={item.input} />;
        }
        if (item.kind === "screenshots") {
          return <ScreenshotStrip key={i} images={item.images} />;
        }
        return <BuildGroupHistory key={i} group={item} />;
      })}
      <ForkFromHere projectId={projectId} messageId={message.id} onBranched={onBranched} />
    </div>
  );
}

type ContentGroup =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; name: string; input: Record<string, unknown> }
  | { kind: "screenshots"; images: Array<{ data: string; mimeType: string }> }
  | {
      kind: "buildGroup";
      steps: Array<{ name: string; input: Record<string, unknown> }>;
      images: Array<{ data: string; mimeType: string }>;
    };

function groupContentBlocks(blocks: ContentBlock[]): ContentGroup[] {
  const result: ContentGroup[] = [];
  let buffer: {
    steps: Array<{ name: string; input: Record<string, unknown> }>;
    images: Array<{ data: string; mimeType: string }>;
  } | null = null;
  const flush = () => {
    if (!buffer) return;
    if (buffer.steps.length === 1 && buffer.images.length === 0) {
      result.push({
        kind: "tool_use",
        name: buffer.steps[0].name,
        input: buffer.steps[0].input,
      });
    } else if (buffer.steps.length > 0) {
      result.push({
        kind: "buildGroup",
        steps: buffer.steps,
        images: buffer.images,
      });
    }
    buffer = null;
  };
  for (const block of blocks) {
    if (block.type === "tool_use" && BUILD_STEP_NAMES.has(block.name)) {
      if (!buffer) buffer = { steps: [], images: [] };
      buffer.steps.push({ name: block.name, input: block.input });
      continue;
    }
    if (block.type === "tool_result" && block.images && block.images.length > 0) {
      if (buffer) {
        buffer.images.push(...block.images);
      } else {
        result.push({ kind: "screenshots", images: block.images });
      }
      continue;
    }
    flush();
    if (block.type === "text") {
      result.push({ kind: "text", text: block.text });
    } else if (block.type === "tool_use") {
      result.push({
        kind: "tool_use",
        name: block.name,
        input: block.input,
      });
    }
  }
  flush();
  return result;
}

function BuildGroupHistory({
  group,
}: {
  group: {
    steps: Array<{ name: string; input: Record<string, unknown> }>;
    images: Array<{ data: string; mimeType: string }>;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] font-mono text-xs">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
      >
        <span>
          <span className="text-[var(--color-success)]">✓</span>{" "}
          <span className="text-[var(--color-fg)]">Built it</span>
          <span className="text-[var(--color-fg-muted)]">
            {" "}
            · {group.steps.length} step
            {group.steps.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-[var(--color-fg-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-[var(--color-border)] px-2 py-2">
          {group.steps.map((step, i) => (
            <ToolUseBubble key={i} name={step.name} input={step.input} />
          ))}
        </div>
      )}
      {group.images.length > 0 && <ScreenshotStrip images={group.images} />}
    </div>
  );
}

function ForkFromHere({
  projectId,
  messageId,
  onBranched,
}: {
  projectId: string;
  messageId?: string;
  onBranched: (newProjectId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!messageId) return null;
  async function fork() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/branch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { id: string };
      onBranched(data.id);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={fork}
        disabled={busy}
        className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-0.5 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-50"
        title="Fork project from this point"
      >
        {busy ? "forking…" : "⑂ fork from here"}
      </button>
    </div>
  );
}

type Scene = {
  index: number;
  durationSeconds: number;
  intent: string;
  beats: string[];
  fx: string[];
};

function PlanCard({ input }: { input: Record<string, unknown> }) {
  const format = String(input.format || "16:9");
  const totalDuration = Number(input.totalDurationSeconds || 0);
  const niche = String(input.niche || "");
  const palette = String(input.palette || "");
  const scenes = (Array.isArray(input.scenes) ? input.scenes : []) as Scene[];
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-2)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-semibold text-black">
            PLAN
          </span>
          <span className="font-mono text-[var(--color-fg-muted)]">
            {format} · {totalDuration}s · {scenes.length} scenes
          </span>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="text-xs text-[var(--color-fg-muted)]">
          <span className="text-[var(--color-fg)]">{niche}</span>
          {palette && <span> · {palette}</span>}
        </div>
        <ol className="space-y-2 text-xs">
          {scenes.map((scene) => (
            <li
              key={scene.index}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            >
              <div className="mb-1 flex items-center justify-between font-mono text-[var(--color-fg-muted)]">
                <span className="font-bold text-[var(--color-accent)]">#{scene.index}</span>
                <span>{scene.durationSeconds}s</span>
              </div>
              <div className="mb-1 font-medium text-[var(--color-fg)]">{scene.intent}</div>
              {scene.beats?.length > 0 && (
                <ul className="ml-3 list-disc space-y-0.5 text-[var(--color-fg-muted)]">
                  {scene.beats.map((beat, i) => (
                    <li key={i}>{beat}</li>
                  ))}
                </ul>
              )}
              {scene.fx?.length > 0 && !(scene.fx.length === 1 && scene.fx[0] === "none") && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {scene.fx.map((fx, i) => (
                    <span
                      key={i}
                      className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent-2)]"
                    >
                      {fx}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ToolUseBubble({
  name,
  input,
  prevContent,
}: {
  name: string;
  input: Record<string, unknown>;
  prevContent?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  if (name === "plan_composition") {
    return <PlanCard input={input} />;
  }
  const isWrite = name === "write_file";
  const path = typeof input.path === "string" ? input.path : "";
  const content = typeof input.content === "string" ? (input.content as string) : "";
  if (isWrite && path) {
    const lineCount = content.split("\n").length;
    const byteCount = content.length;
    const diff = prevContent !== undefined ? computeLineDiff(prevContent, content) : null;
    return (
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] font-mono text-xs">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <span className="text-[var(--color-accent)]">✎</span>{" "}
            <span className="text-[var(--color-fg)]">{path}</span>
            {diff ? (
              <span className="ml-1 shrink-0">
                <span className="text-[var(--color-success)]">+{diff.added}</span>
                <span className="text-[var(--color-fg-muted)]">/</span>
                <span className="text-[var(--color-danger)]">-{diff.removed}</span>
              </span>
            ) : (
              <span className="text-[var(--color-fg-muted)]">
                · {lineCount} lines · {byteCount.toLocaleString()}B
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {diff && expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDiffMode((v) => !v);
                }}
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${diffMode ? "bg-[var(--color-accent)] text-black" : "bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"}`}
              >
                diff
              </button>
            )}
            <span className="text-[var(--color-fg-muted)]">{expanded ? "−" : "+"}</span>
          </div>
        </button>
        {expanded &&
          (diffMode && diff ? (
            <div className="max-h-64 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] leading-snug">
              {diff.hunks.map((hunk, i) => {
                if (hunk.kind === "same") return null;
                return (
                  <div
                    key={i}
                    className={`font-mono ${hunk.kind === "add" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"}`}
                  >
                    {hunk.kind === "add" ? "+" : "-"} {hunk.line}
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="max-h-64 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] leading-snug">
              {content.slice(0, 8000)}
              {content.length > 8000 && "\n…(truncated)"}
            </pre>
          ))}
      </div>
    );
  }
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 font-mono text-xs text-[var(--color-fg-muted)]">
      <span className="text-[var(--color-success)]">✓</span>{" "}
      <span className="text-[var(--color-fg)]">{name}</span>
      <span>({summarizeToolInput(name, input)})</span>
    </div>
  );
}

function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "write_file") {
    const path = String(input.path || "");
    const len = String(input.content || "").length;
    return `${path}, ${len}B`;
  }
  if (name === "read_file" || name === "read_registry_block") {
    return String(input.path || input.name || "");
  }
  const entries = Object.entries(input);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}=${truncate(String(v).replace(/\s+/g, " "), 30)}`).join(", ");
}

function truncate(text: string, n: number): string {
  return text.length > n ? text.slice(0, n) + "…" : text;
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

function computeLineDiff(
  prev: string,
  next: string,
): {
  added: number;
  removed: number;
  hunks: Array<{ kind: "add" | "remove" | "same"; line: string }>;
} {
  const MAX_LINES = 600;
  const prevLines = prev.split("\n").slice(0, MAX_LINES);
  const nextLines = next.split("\n").slice(0, MAX_LINES);
  const pn = prevLines.length;
  const nn = nextLines.length;
  const dp: number[][] = Array.from({ length: pn + 1 }, () => new Array(nn + 1).fill(0));
  for (let i = 1; i <= pn; i++) {
    for (let j = 1; j <= nn; j++) {
      dp[i][j] =
        prevLines[i - 1] === nextLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const hunks: Array<{ kind: "add" | "remove" | "same"; line: string }> = [];
  let i = pn;
  let j = nn;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevLines[i - 1] === nextLines[j - 1]) {
      hunks.unshift({ kind: "same", line: prevLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      hunks.unshift({ kind: "add", line: nextLines[j - 1] });
      j--;
    } else {
      hunks.unshift({ kind: "remove", line: prevLines[i - 1] });
      i--;
    }
  }
  const added = hunks.filter((h) => h.kind === "add").length;
  const removed = hunks.filter((h) => h.kind === "remove").length;
  return { added, removed, hunks };
}
