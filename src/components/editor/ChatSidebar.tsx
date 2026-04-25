"use client";

import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Project } from "@/lib/scene-schema";
import { useAssetStore } from "@/store/asset-store";
import { useChatStore, type ChatMessage } from "@/store/chat-store";
import { useProjectStore } from "@/store/project-store";
import { useVoiceStore } from "@/store/voice-store";

export function ChatSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendText = useChatStore((s) => s.appendText);
  const addToolCall = useChatStore((s) => s.addToolCall);
  const updateToolCall = useChatStore((s) => s.updateToolCall);
  const finishAssistantMessage = useChatStore((s) => s.finishAssistantMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const undoTurn = useChatStore((s) => s.undoTurn);
  const removeMessage = useChatStore((s) => s.removeMessage);

  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const { characters, sfx } = useAssetStore();

  const [input, setInput] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const activeVoice = useVoiceStore((s) => s.activeVoice);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight });
      setShowScrollDown(false);
    } else {
      setShowScrollDown(true);
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollDown(!nearBottom);
  };

  // Auto-focus the input when the sidebar opens.
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ESC cancels an in-flight agent turn, from anywhere.
  useEffect(() => {
    if (!isStreaming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        toast("Stopped agent", { description: "ESC any time to cancel.", duration: 1200 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isStreaming]);

  // Cmd+R (prevent default browser reload) = "try again, differently".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        if (!open) return;
        if (messages.length === 0) return;
        e.preventDefault();
        void send("Try that again — different approach this time.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messages.length]);

  const showEmptyState =
    messages.length === 0 && project.scenes.length === 0 && !project.script;

  const send = async (override?: string) => {
    const content = (override ?? input).trim();
    if (!content || isStreaming) return;
    if (!override) setInput("");

    // Slash commands bypass the agent.
    if (content.startsWith("/")) {
      const [cmd, ...rest] = content.slice(1).trim().split(/\s+/);
      const arg = rest.join(" ");
      if (cmd === "new") {
        useProjectStore.getState().createProject();
        toast.success("New project created");
        return;
      }
      if (cmd === "reset" || cmd === "clear") {
        if (!window.confirm("Clear all scenes + script?")) return;
        useProjectStore.getState().setScenes([]);
        useProjectStore.getState().setScript("");
        toast.success("Project reset");
        return;
      }
      if (cmd === "render") {
        if (useProjectStore.getState().project.scenes.length === 0) {
          toast.error("Nothing to render — make scenes first");
          return;
        }
        document
          .querySelector<HTMLButtonElement>('button[title*="Render"]')
          ?.click();
        return;
      }
      if (cmd === "stop") {
        abortRef.current?.abort();
        toast("Stopped");
        return;
      }
      if (cmd === "undo") {
        // Undo the most recent assistant turn that has a snapshot.
        const msgs = useChatStore.getState().messages;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant" && msgs[i].projectBefore) {
            handleUndo(msgs[i].id);
            toast("Undid last turn", { duration: 800 });
            return;
          }
        }
        toast("Nothing to undo");
        return;
      }
      if (cmd === "save") {
        // Force a fresh JSON snapshot into localStorage by bumping a trivial
        // state field. Zustand's persist middleware will flush within 300ms.
        useProjectStore.setState({});
        useChatStore.setState({});
        toast("Saving…", { duration: 800 });
        return;
      }
      if (cmd === "template" || cmd === "workflow") {
        // Power-user escape hatch: opens the legacy workflow picker.
        window.dispatchEvent(new CustomEvent("vibeedit:open-template-picker"));
        return;
      }
      if (cmd === "prompt") {
        // `/prompt` — show current project system prompt + offer to edit.
        // `/prompt <text>` sets it directly. `/prompt -` clears it.
        const currentPrompt = useProjectStore.getState().project.systemPrompt;
        if (!arg) {
          const fresh = window.prompt(
            "Project-specific system prompt (empty to clear):",
            currentPrompt ?? "",
          );
          if (fresh !== null) {
            useProjectStore.getState().setSystemPrompt(fresh);
            toast(fresh.trim() ? "System prompt set" : "System prompt cleared", {
              duration: 800,
            });
          }
        } else if (arg === "-") {
          useProjectStore.getState().setSystemPrompt("");
          toast("System prompt cleared", { duration: 800 });
        } else {
          useProjectStore.getState().setSystemPrompt(arg);
          toast("System prompt set", { duration: 800 });
        }
        return;
      }
      if (cmd === "status") {
        fetch("/api/bridge/status", { cache: "no-store" })
          .then((r) => r.json())
          .then((st) => {
            const mode = st.bridge
              ? `file-bridge (${st.pending} pending)`
              : st.isProxied
                ? `proxy → ${st.baseUrl}${st.upstreamReachable === false ? " (UNREACHABLE)" : ""}`
                : "direct Anthropic API";
            toast(`Backend: ${mode}`, {
              description: st.hasAnthropicKey
                ? "API key is configured."
                : "⚠ no ANTHROPIC_API_KEY set.",
              duration: 6000,
            });
          })
          .catch(() => toast.error("Could not reach /api/bridge/status"));
        return;
      }
      if (cmd === "help") {
        toast("Slash commands", {
          description:
            "/new — new project\n/reset — clear scenes\n/render — render now\n/undo — undo last turn\n/save — flush state to localStorage\n/status — show AI backend info\n/prompt — set a project-specific system prompt\n/template — pick a structured workflow template\n/models — list available AI models / voices\n/voice <id>\n/preset <id>\n/export — open export pack\n/tips — workflow tips\n/help — this menu",
          duration: 8000,
        });
        return;
      }
      if (cmd === "models") {
        try {
          const [m, v] = await Promise.all([
            fetch("/api/media/models").then((r) => r.json()),
            fetch("/api/media/voices").then((r) => r.json()),
          ]);
          const lines: string[] = [];
          for (const x of (m.models ?? []) as Array<{
            id: string;
            kind: string;
            estimatedCostUsd: number;
            tags?: string[];
          }>) {
            lines.push(
              `${x.kind === "image" ? "🖼" : "🎬"} ${x.id} · $${x.estimatedCostUsd} · ${(x.tags ?? []).join(",")}`,
            );
          }
          for (const x of (v.voices ?? []) as Array<{
            id: string;
            costPer1kChars: number;
            tags?: string[];
          }>) {
            lines.push(`🎙 ${x.id} · $${x.costPer1kChars}/1k · ${(x.tags ?? []).join(",")}`);
          }
          toast("AI catalog", { description: lines.join("\n"), duration: 15000 });
        } catch {
          toast.error("Couldn't fetch catalog");
        }
        return;
      }
      if (cmd === "tips") {
        toast("Pro tips", {
          description:
            "• Drop a .txt file here → becomes a script\n• Space plays the preview; ESC cancels the agent\n• Right-click a scene → quick actions\n• Cmd+R = 'try again differently'\n• Script is 1 line per scene — keep lines short",
          duration: 10000,
        });
        return;
      }
      if (cmd === "export") {
        document
          .querySelector<HTMLButtonElement>('button[title="Export a platform-ready pack"]')
          ?.click();
        return;
      }
      if (cmd === "voice") {
        const { useVoiceStore } = await import("@/store/voice-store");
        if (!arg) {
          toast("Usage: /voice alloy|echo|fable|onyx|nova|shimmer");
          return;
        }
        useVoiceStore.getState().setActive({ kind: "openai", id: arg });
        toast.success(`Voice set to ${arg}`);
        return;
      }
      if (cmd === "preset") {
        if (!arg) {
          toast("Usage: /preset <id>");
          return;
        }
        useProjectStore.getState().applyStylePreset(arg);
        toast.success(`Applied "${arg}" preset`);
        return;
      }
      toast.error(`Unknown command: /${cmd}`, {
        description: "Try /new, /reset, /render, /voice, /preset",
      });
      return;
    }

    // Replay the conversation to the server minus streaming placeholders.
    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => ({
        role: m.role,
        content: m.role === "assistant" ? compactAssistant(m) : m.content,
      }));
    history.push({ role: "user" as const, content });
    addUserMessage(content);

    // Snapshot project BEFORE we start applying the turn's effects.
    const projectBefore: Project = JSON.parse(JSON.stringify(project));
    const msgId = startAssistantMessage(projectBefore);
    setStreaming(true);

    try {
      const abortCtrl = new AbortController();
      abortRef.current = abortCtrl;
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          project: projectBefore,
          characters,
          sfx,
        }),
        signal: abortCtrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) setNeedsKey(true);
        throw new Error(data.error ?? `agent failed (${res.status})`);
      }
      setNeedsKey(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let errored = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice("data: ".length);
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "text" && typeof evt.text === "string") {
            appendText(msgId, evt.text);
          } else if (evt.type === "tool_start") {
            addToolCall(msgId, {
              id: String(evt.id ?? Math.random()),
              name: String(evt.name ?? "unknown"),
              args: (evt.args as Record<string, unknown>) ?? {},
            });
          } else if (evt.type === "tool_result") {
            updateToolCall(msgId, String(evt.id ?? ""), {
              ok: Boolean(evt.ok),
              message: String(evt.message ?? ""),
            });
          } else if (evt.type === "done" && evt.project) {
            setProject(evt.project as Project);
          } else if (evt.type === "error") {
            errored = true;
            const raw = String(evt.error ?? "agent error");
            // Friendlier copy when the bridge / proxy path timed out.
            const friendly = /didn't respond|timed out|timeout/i.test(raw)
              ? `${raw}\n\n→ If you're using cliproxy, check that its OAuth file still exists at /root/.cli-proxy-api/ on the server. If you're using the file-queue bridge, make sure a Claude Code session is watching .ai-bridge/pending/.`
              : raw;
            appendText(msgId, `\n⚠️ ${friendly}`);
          }
        }
      }
      if (errored) toast.error("Agent hit an error — see the chat for details");
    } catch (e) {
      appendText(
        msgId,
        `\n⚠️ ${e instanceof Error ? e.message : String(e)}`,
      );
      toast.error("Agent failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      finishAssistantMessage(msgId);
      setStreaming(false);
    }
  };

  const handleUndo = (messageId: string) => {
    const before = undoTurn(messageId);
    if (before) {
      setProject(before);
      toast("Turn undone");
    }
  };

  const [dragOver, setDragOver] = useState(false);

  const handleDroppedFiles = async (files: FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    // Plain-text drops bypass upload — read inline and hand the content to the
    // agent as a script.
    const textFiles = list.filter(
      (f) => f.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(f.name),
    );
    if (textFiles.length === list.length) {
      const chunks = await Promise.all(textFiles.map((f) => f.text()));
      const combined = chunks.join("\n\n").trim();
      if (combined) {
        await send(
          `Make scenes from this script (dropped as ${textFiles.length} file${textFiles.length === 1 ? "" : "s"}):\n\n${combined}`,
        );
      }
      return;
    }
    const oversized = list.filter((f) => f.size > 200 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(
        `${oversized.length} file${oversized.length === 1 ? " is" : "s are"} over 200MB — upload rejected.`,
      );
      return;
    }
    const toastId = toast.loading(`Uploading ${list.length} file(s)...`);
    const uploaded: Array<{ name: string; url: string; type: string }> = [];
    try {
      for (const f of list) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/assets/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "upload failed");
        uploaded.push({ name: f.name, url: data.url, type: f.type });
      }
      toast.success(`Uploaded ${uploaded.length}`, {
        id: toastId,
        description: "Telling the agent to use them...",
      });
      const summary = uploaded
        .map((u) => `- ${u.name} (${u.type || "unknown"}) at ${u.url}`)
        .join("\n");
      await send(
        `I dropped these files into chat:\n${summary}\n\nUse them in the right workflow slot (e.g. commentary clips, comic panels, music).`,
      );
    } catch (e) {
      toast.error("Upload failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Persisted sidebar width (px). Drag the right edge to resize.
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 320;
    const raw = window.localStorage.getItem("vibeedit:chat-width");
    const n = raw ? Number(raw) : 0;
    return n >= 240 && n <= 720 ? n : 320;
  });
  const resizingRef = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const next = Math.min(720, Math.max(240, e.clientX));
      setWidth(next);
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      window.localStorage.setItem("vibeedit:chat-width", String(width));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  if (!open) return null;

  // On phones the chat takes the full viewport so the editor isn't a
  // 60-pixel sliver. The persisted desktop width still applies on ≥640px.
  const aside_style: React.CSSProperties =
    typeof window !== "undefined" && window.innerWidth < 640
      ? { width: "100vw", maxWidth: "100vw" }
      : { width };
  return (
    <aside
      style={aside_style}
      className={`flex flex-col border-r border-neutral-800 bg-neutral-950 shrink-0 relative ${
        dragOver ? "ring-2 ring-inset ring-emerald-400/60" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) {
          handleDroppedFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 shrink-0">
        <MessageCircle className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Vibe</span>
        <span
          className="text-[9px] font-mono bg-neutral-900 border border-neutral-800 rounded px-1 text-neutral-400"
          title="Active voice — /voice <name> to change"
        >
          {activeVoice.kind === "elevenlabs" ? "cloned" : activeVoice.id}
        </span>
        {messages.length > 0 && (
          <>
            <button
              onClick={() => {
                const md = messages
                  .map((m) => {
                    const role = m.role === "user" ? "### You" : "### Agent";
                    const tools = m.toolCalls?.length
                      ? "\n" +
                        m.toolCalls
                          .map(
                            (c) =>
                              `- ${c.ok ? "✓" : c.ok == null ? "…" : "✗"} ${c.name}${c.message ? ` — ${c.message}` : ""}`,
                          )
                          .join("\n")
                      : "";
                    return `${role}\n${m.content || ""}${tools}`.trim();
                  })
                  .join("\n\n---\n\n");
                navigator.clipboard?.writeText(md).catch(() => {});
                toast(`Copied ${messages.length} messages`, { duration: 900 });
              }}
              className="ml-auto text-[10px] text-neutral-600 hover:text-emerald-400 p-1"
              title="Copy conversation as Markdown"
            >
              <ClipboardCopy className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (window.confirm("Clear chat history?")) {
                  useChatStore.getState().clear();
                  toast("Cleared");
                }
              }}
              className="text-[10px] text-neutral-600 hover:text-red-400"
              title="Clear chat history"
            >
              clear
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="ml-auto text-sm text-neutral-500 hover:text-white px-1"
          title="Hide (Cmd+K)"
        >
          ×
        </button>
      </div>
      {needsKey && (
        <div className="px-3 py-2 border-b border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300">
          ⚠ <code>ANTHROPIC_API_KEY</code> not set on the server. See{" "}
          <code>.env.local.example</code>.
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onClick={(e) => {
          // Clicking the background (not a button/link/text inside) jumps
          // focus into the input. Cuts down extra clicks.
          if ((e.target as HTMLElement).tagName === "DIV") {
            inputRef.current?.focus();
          }
        }}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 relative"
      >
        {showEmptyState && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 pt-2">
              <span className="text-lg font-semibold text-white leading-tight">
                What do you want to make?
              </span>
              <span className="text-[11px] text-neutral-500">
                Type below. Or use the Create Project dialog on the home page
                if you want to upload assets and set instructions first.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                Example prompts
              </span>
              {[
                "Make a 60s TikTok about morning routines for coders",
                "A faceless video: 5 startup mistakes I made",
                "Review the last movie I watched in 45 seconds",
                "A 3-step recipe reel for quick chocolate mug cake",
                "Comic dub my uploaded panels — punchy, sarcastic",
                "Gaming highlights reel from my clips — hype paced",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  disabled={isStreaming}
                  className="text-left text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
            <span className="text-[9px] text-neutral-700 text-center pt-4">
              Built on Claude + Remotion · Type / for commands · ? for shortcuts
            </span>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            onUndo={() => handleUndo(m.id)}
            onDelete={() => removeMessage(m.id)}
            onQuickReply={(text) => send(text)}
            isLatest={i === messages.length - 1}
          />
        ))}
      </div>
      {showScrollDown && (
        <button
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setShowScrollDown(false);
          }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-lg z-10"
        >
          ↓ latest
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 p-2 border-t border-neutral-800 shrink-0 relative"
      >
        {input === "/" && (
          <div className="absolute bottom-full left-2 right-14 mb-1 bg-neutral-950 border border-neutral-800 rounded shadow-lg overflow-hidden z-10">
            {[
              { cmd: "new", desc: "Start a new project" },
              { cmd: "reset", desc: "Clear scenes + script" },
              { cmd: "render", desc: "Render this project" },
              { cmd: "voice ", desc: "Set TTS voice (e.g. /voice nova)" },
              { cmd: "preset ", desc: "Apply style preset" },
              { cmd: "export", desc: "Open platform export pack" },
              { cmd: "help", desc: "Show all commands" },
            ].map((c) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => setInput(`/${c.cmd}`)}
                className="flex items-center gap-2 w-full px-2 py-1 text-left text-xs text-neutral-200 hover:bg-neutral-800"
              >
                <span className="font-mono text-emerald-400">/{c.cmd}</span>
                <span className="text-neutral-500">— {c.desc}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={async (e) => {
            const files = Array.from(e.clipboardData.items)
              .map((it) => (it.kind === "file" ? it.getAsFile() : null))
              .filter((f): f is File => f !== null);
            if (files.length > 0) {
              e.preventDefault();
              const dt = new DataTransfer();
              for (const f of files) dt.items.add(f);
              await handleDroppedFiles(dt.files);
              return;
            }
            const text = e.clipboardData.getData("text").trim();
            // A single URL → hand it to the agent as an ingest candidate.
            if (/^https?:\/\/\S+$/.test(text)) {
              e.preventDefault();
              setInput(
                (prev) =>
                  prev +
                  (prev.endsWith(" ") || prev.length === 0 ? "" : " ") +
                  `Import from this URL and use it appropriately: ${text}`,
              );
              return;
            }
            // If the clipboard has a long text block, prepend a nudge so the
            // agent knows to treat it as a script.
            const lines = text.split("\n").filter((l) => l.trim()).length;
            if (lines >= 4) {
              e.preventDefault();
              setInput(
                (prev) =>
                  prev +
                  (prev.endsWith("\n") || prev.length === 0 ? "" : "\n") +
                  `Make scenes from this script:\n${text}`,
              );
            }
          }}
          placeholder={
            isStreaming
              ? "working..."
              : messages.length === 0
                ? "Make a 60s TikTok about… (try / for commands)"
                : "What next? (try / for commands)"
          }
          disabled={isStreaming}
          rows={Math.min(8, Math.max(1, input.split("\n").length))}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-[13px] text-white resize-none focus:outline-none focus:border-emerald-500 placeholder:text-neutral-600"
        />
        {!isStreaming && (
          <>
            <input
              type="file"
              multiple
              className="hidden"
              id="chat-upload-input"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  await handleDroppedFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <label
              htmlFor="chat-upload-input"
              title="Attach files (or drag & drop into the chat)"
              className="flex items-center justify-center h-8 w-8 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </label>
          </>
        )}
        {isStreaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            title="Stop the agent"
            className="flex items-center justify-center h-8 w-8 rounded bg-red-600 hover:bg-red-500 text-white"
          >
            ■
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            title="Send (Enter)"
            className="flex items-center justify-center h-8 w-8 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
      {/* Right-edge resize handle. Drag to widen/narrow the chat. */}
      <div
        onMouseDown={() => {
          resizingRef.current = true;
          document.body.style.cursor = "ew-resize";
        }}
        title="Drag to resize chat"
        className="absolute top-0 right-0 h-full w-1 cursor-ew-resize hover:bg-emerald-500/40"
      />
    </aside>
  );
}

function formatRelativeTime(d: Date): string {
  const diffSec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function MessageBubble({
  message,
  onUndo,
  onDelete,
  onQuickReply,
  isLatest,
}: {
  message: ChatMessage;
  onUndo: () => void;
  onDelete: () => void;
  onQuickReply: (text: string) => void;
  isLatest: boolean;
}) {
  // Collapse tool call lists by default — less visual noise in the chat.
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const isUser = message.role === "user";
  const toolCount = message.toolCalls?.length ?? 0;
  const timestamp = new Date(message.createdAt);

  // Show quick-reply chips if the latest non-streaming assistant message ends
  // with a question. "Yes" sends a confirmation; "Not now" dismisses quietly.
  const asksQuestion =
    !message.streaming &&
    !isUser &&
    isLatest &&
    /\?\s*$/.test(message.content.trim());

  return (
    <div
      title={timestamp.toLocaleString()}
      className={`flex flex-col gap-1 rounded-lg p-2 border text-xs ${
        isUser
          ? "bg-emerald-500/5 border-emerald-500/20 self-end max-w-[90%]"
          : "bg-neutral-900 border-neutral-800 self-start w-full"
      }`}
    >
      {isUser ? (
        <div className="text-white whitespace-pre-wrap">{message.content}</div>
      ) : (
        <>
          {toolCount > 0 && (() => {
            const okCount = message.toolCalls!.filter((c) => c.ok === true).length;
            const failCount = message.toolCalls!.filter((c) => c.ok === false).length;
            const pendingCount = toolCount - okCount - failCount;
            return (
              <button
                onClick={() => setToolsExpanded((v) => !v)}
                className="flex items-start gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 text-left"
              >
                {toolsExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                )}
                {toolsExpanded ? (
                  <span>
                    {toolCount} tool call{toolCount === 1 ? "" : "s"}
                    {failCount > 0 && (
                      <span className="ml-1 text-red-400 font-medium">
                        · {failCount} failed
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="ml-1 text-amber-400">
                        · {pendingCount} in-flight
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex-1 font-mono truncate">
                    {message
                      .toolCalls!.map(
                        (c) =>
                          `${c.ok == null ? "…" : c.ok ? "✓" : "✗"} ${c.name}`,
                      )
                      .join(" · ")}
                  </span>
                )}
              </button>
            );
          })()}
          {toolsExpanded && toolCount > 0 && (
            <div className="flex flex-col gap-0.5 pl-1 border-l border-neutral-800">
              {message.toolCalls!.map((c) => (
                <div
                  key={c.id}
                  title={
                    c.args
                      ? `${c.name}(${JSON.stringify(c.args, null, 0).slice(0, 300)})`
                      : c.name
                  }
                  className="flex items-start gap-1.5 text-[10px] leading-tight animate-[fadeIn_150ms_ease-out]"
                >
                  <span
                    className={`font-mono ${
                      c.ok == null
                        ? "text-neutral-500"
                        : c.ok
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {c.ok == null ? "…" : c.ok ? "✓" : "✗"}
                  </span>
                  <span className="text-white font-mono">{c.name}</span>
                  {c.message && (
                    <span className="text-neutral-500 truncate">— {c.message}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {message.content && (
            <div className="relative group text-neutral-200 whitespace-pre-wrap leading-snug">
              {message.content}
              {message.content.length > 140 && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(message.content).catch(() => {});
                    toast("Copied", { duration: 600 });
                  }}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-emerald-400 transition-opacity bg-neutral-900/80 rounded"
                  title="Copy message"
                >
                  <ClipboardCopy className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {message.streaming && (() => {
            const active = message.toolCalls?.find((c) => c.ok === null);
            return (
              <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                {active ? `running ${active.name}...` : "thinking..."}
              </div>
            );
          })()}
          {asksQuestion && (
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={() => onQuickReply("yes, do it")}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded"
              >
                Yes
              </button>
              <button
                onClick={() => onQuickReply("not now — try something else")}
                className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded"
              >
                Not now
              </button>
            </div>
          )}
          {!message.streaming && message.projectBefore && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onUndo}
                className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-white"
              >
                <Undo2 className="h-3 w-3" />
                undo this turn
              </button>
              <span className="text-[10px] text-neutral-700 font-mono">
                {formatRelativeTime(timestamp)}
              </span>
              <button
                onClick={onDelete}
                className="text-[10px] text-neutral-600 hover:text-red-400 ml-auto"
              >
                remove
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function compactAssistant(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.toolCalls && message.toolCalls.length > 0) {
    parts.push(
      `[ran ${message.toolCalls
        .map((c) => `${c.name}${c.ok === false ? "(failed)" : ""}`)
        .join(", ")}]`,
    );
  }
  if (message.content) parts.push(message.content);
  return parts.join("\n");
}
