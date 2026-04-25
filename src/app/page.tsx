"use client";

import { CalendarClock, Film, ListVideo, MessageCircle, Redo2, Smartphone, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AuthBar } from "@/components/editor/AuthBar";
import { BatchVariantsButton } from "@/components/editor/BatchVariantsButton";
import { BridgeIndicator } from "@/components/editor/BridgeIndicator";
import { DevBadge } from "@/components/editor/DevBadge";
import { ProjectHome } from "@/components/editor/ProjectHome";
import { BulkActionsBar } from "@/components/editor/BulkActionsBar";
import { ChatSidebar } from "@/components/editor/ChatSidebar";
import { CreateProjectDialog } from "@/components/editor/CreateProjectDialog";
import { ConfigTabs } from "@/components/editor/ConfigTabs";
import { ExportPackButton } from "@/components/editor/ExportPackButton";
import { HeaderOverflow } from "@/components/editor/HeaderOverflow";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { KeyboardShortcuts } from "@/components/editor/KeyboardShortcuts";
import { ProjectIO } from "@/components/editor/ProjectIO";
import { ProjectSwitcher } from "@/components/editor/ProjectSwitcher";
import { RenderButton } from "@/components/editor/RenderButton";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { RenderQueuePanel } from "@/components/editor/RenderQueuePanel";
import { ReviewPanel } from "@/components/editor/ReviewPanel";
import { ThemeToggle } from "@/components/editor/ThemeToggle";
import { ThumbnailExporter } from "@/components/editor/ThumbnailExporter";
import { SceneEditor } from "@/components/editor/SceneEditor";
import { WorkflowPicker } from "@/components/editor/WorkflowPicker";
import { SceneList } from "@/components/editor/SceneList";
import { ShortcutsOverlay } from "@/components/editor/ShortcutsOverlay";
import { ScheduleRenderDialog } from "@/components/editor/ScheduleRenderDialog";
import { SceneToolsPanel } from "@/components/editor/SceneToolsPanel";
import { useChatStore } from "@/store/chat-store";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";

const Preview = dynamic(
  () => import("@/components/editor/Preview").then((m) => m.Preview),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-black text-neutral-600 text-sm rounded-lg">
        Loading preview engine...
      </div>
    ),
  },
);

export default function Home() {
  const project = useProjectStore((s) => s.project);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const historyLen = useProjectStore((s) => s.history.length);
  const futureLen = useProjectStore((s) => s.future.length);
  const canUndo = historyLen > 0;
  const canRedo = futureLen > 0;
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const queueCount = useRenderQueueStore((s) => s.items.length);
  const toggleQueue = useRenderQueueStore((s) => s.togglePanel);

  // Chat-first: the modal picker no longer auto-opens. The chat sidebar's
  // empty state shows workflow cards inline. The picker is still reachable
  // via the WorkflowBadge in the header for users who want the full view.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Always start `true` so SSR and first client render agree. A post-mount
  // effect collapses the sidebar on narrow screens — avoids hydration mismatch.
  const [chatOpen, setChatOpenState] = useState(true);
  const setChatOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    setChatOpenState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        window.localStorage.setItem("vibeedit:chat-open", String(next));
      } catch {}
      return next;
    });
  };
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("vibeedit:chat-open");
      if (saved === "false") setChatOpenState(false);
    } catch {}
  }, []);
  // First-run landing: show ProjectHome instead of the editor when the user
  // hasn't engaged yet (current project is empty + never dismissed).
  const [homeDismissed, setHomeDismissed] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  useEffect(() => {
    const handler = () => setTemplatePickerOpen(true);
    window.addEventListener("vibeedit:open-template-picker", handler);
    return () =>
      window.removeEventListener("vibeedit:open-template-picker", handler);
  }, []);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Layout: users can collapse the scene list / editor panels for focused
  // work. Persisted to localStorage so preference survives reloads.
  const [leftCollapsed, setLeftCollapsedState] = useState(false);
  const [rightCollapsed, setRightCollapsedState] = useState(false);
  const setLeftCollapsed = (v: boolean) => {
    setLeftCollapsedState(v);
    try {
      window.localStorage.setItem("vibeedit:left-collapsed", String(v));
    } catch {}
  };
  const setRightCollapsed = (v: boolean) => {
    setRightCollapsedState(v);
    try {
      window.localStorage.setItem("vibeedit:right-collapsed", String(v));
    } catch {}
  };
  useEffect(() => {
    try {
      if (window.localStorage.getItem("vibeedit:left-collapsed") === "true")
        setLeftCollapsedState(true);
      if (window.localStorage.getItem("vibeedit:right-collapsed") === "true")
        setRightCollapsedState(true);
    } catch {}
  }, []);
  const chatHasMessages = useChatStore((s) => s.messages.length > 0);
  const agentStreaming = useChatStore((s) => s.isStreaming);
  const showHome =
    !homeDismissed &&
    project.scenes.length === 0 &&
    !project.script &&
    !chatHasMessages;

  useEffect(() => {
    // One-shot post-hydration sync — eslint's cascading-renders warning
    // doesn't apply to a single mount-time collapse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth < 1024) setChatOpen(false);
  }, []);

  // Cmd/Ctrl+K focuses the chat input from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChatOpen((prev) => {
          const next = !prev;
          if (next) {
            setTimeout(() => {
              document
                .querySelector<HTMLTextAreaElement>("aside textarea")
                ?.focus();
            }, 50);
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100">
      <KeyboardShortcuts />
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setHomeDismissed(false)}
            onDoubleClick={() => {
              // Double-click the logo opens the shortcuts overlay.
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "?" }),
              );
            }}
            title="Home (double-click for shortcuts)"
            aria-label="Go to home"
            className="shrink-0"
          >
            <Film className="h-5 w-5 text-emerald-400" aria-label="VibeEdit" />
          </button>
          <DevBadge />
          <ProjectSwitcher />
          <button
            onClick={() => setChatOpen((v) => !v)}
            title="Toggle vibe chat (Cmd/Ctrl+K)"
            className={`relative flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              chatOpen
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-[10px] font-mono text-neutral-500">⌘K</span>
            {agentStreaming && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title={`Undo (Cmd/Ctrl+Z) — ${historyLen} step${historyLen === 1 ? "" : "s"}`}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 className="h-4 w-4" aria-label="Undo" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title={`Redo (Shift+Cmd/Ctrl+Z) — ${futureLen} step${futureLen === 1 ? "" : "s"}`}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 className="h-4 w-4" aria-label="Redo" />
            </button>
          </div>
          <a
            href="/download"
            title="Get VibeEdit as an app"
            className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors px-1.5 py-0.5"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Get the app</span>
          </a>
          <button
            onClick={toggleQueue}
            title="Render queue"
            className="relative p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ListVideo className="h-4 w-4" aria-label="Render queue" />
            {queueCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-emerald-500 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </button>
          <BridgeIndicator />
          <SaveIndicator />
          <AuthBar />
          <HeaderOverflow>
            <ThemeToggle />
            <ProjectIO />
            <ThumbnailExporter />
            <ExportPackButton />
            <ReviewPanel />
            <BatchVariantsButton />
            <button
              onClick={() => setScheduleOpen(true)}
              disabled={project.scenes.length === 0}
              title="Schedule a render for later"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Schedule</span>
            </button>
          </HeaderOverflow>
          <RenderButton />
        </div>
      </header>

      {/* First-run landing: project picker instead of empty editor. */}
      {showHome && (
        <div className="flex-1 min-h-0">
          <ProjectHome onStart={() => setHomeDismissed(true)} />
        </div>
      )}

      {/* Main layout */}
      {!showHome && (
      <div className="flex flex-1 min-h-0">
        <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
        {/* Left: scene list + tools — hidden until scenes exist so the empty
            state is just chat + preview (way less busy). */}
        {project.scenes.length > 0 && !leftCollapsed && (
          <div className="w-80 flex flex-col border-r border-neutral-800 shrink-0 overflow-hidden relative">
            <button
              onClick={() => setLeftCollapsed(true)}
              title="Collapse scene list"
              className="absolute top-1 right-1 z-10 text-[10px] text-neutral-600 hover:text-white px-1"
            >
              ‹
            </button>
            <div className="flex-1 overflow-y-auto">
              <SceneList />
            </div>
            <details className="border-t border-neutral-800 overflow-y-auto max-h-[45vh]">
              <summary className="px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 cursor-pointer list-none flex items-center justify-between">
                <span>Tools & config</span>
                <span className="text-neutral-700">▾</span>
              </summary>
              <SceneToolsPanel />
              <ConfigTabs />
            </details>
          </div>
        )}

        {/* A tiny "show scene list" tab when the left column is collapsed. */}
        {project.scenes.length > 0 && leftCollapsed && (
          <button
            onClick={() => setLeftCollapsed(false)}
            title="Show scene list"
            className="shrink-0 px-1 border-r border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-900 text-xs"
          >
            ›
          </button>
        )}

        {/* Center: preview. Click the padding area (not the player) to
            deselect the current scene and go back to the full-video view. */}
        <div
          className="flex-1 flex flex-col p-4 min-w-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              useProjectStore.getState().clearSelection();
            }
          }}
        >
          <div className="flex-1 min-h-0">
            <Preview />
          </div>
        </div>

        {/* Right: scene editor — only when a scene is selected */}
        {selectedSceneId &&
          project.scenes.some((s) => s.id === selectedSceneId) &&
          !rightCollapsed && (
            <div
              data-scene-editor
              className="w-72 border-l border-neutral-800 shrink-0 overflow-y-auto relative"
            >
              <button
                onClick={() => setRightCollapsed(true)}
                title="Collapse scene editor"
                className="absolute top-1 left-1 z-10 text-[10px] text-neutral-600 hover:text-white px-1"
              >
                ›
              </button>
              <SceneEditor />
            </div>
          )}
        {/* Tab to restore the scene editor when it was manually collapsed. */}
        {selectedSceneId &&
          project.scenes.some((s) => s.id === selectedSceneId) &&
          rightCollapsed && (
            <button
              onClick={() => setRightCollapsed(false)}
              title="Show scene editor"
              className="shrink-0 px-1 border-l border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-900 text-xs"
            >
              ‹
            </button>
          )}
      </div>
      )}

      <ImageEditor />
      <RenderQueuePanel />
      <BulkActionsBar />
      <ScheduleRenderDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <ShortcutsOverlay />
      <WorkflowPicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
      />
      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setHomeDismissed(true);
        }}
      />
    </div>
  );
}
