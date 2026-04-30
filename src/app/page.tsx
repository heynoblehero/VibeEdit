"use client";

import { CalendarClock, Film, ListVideo, MessageCircle, Redo2, Settings, Smartphone, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AuthBar } from "@/components/editor/AuthBar";
import { BatchVariantsButton } from "@/components/editor/BatchVariantsButton";
import { BridgeIndicator } from "@/components/editor/BridgeIndicator";
import { DevBadge } from "@/components/editor/DevBadge";
import { SettingsDialog } from "@/components/editor/SettingsDialog";
import { MasterMixButton } from "@/components/editor/MasterMixButton";
import { BulkActionsBar } from "@/components/editor/BulkActionsBar";
import { ChatSidebar } from "@/components/editor/ChatSidebar";
import { ConfigTabs } from "@/components/editor/ConfigTabs";
import { ExportPackButton } from "@/components/editor/ExportPackButton";
import { SubtitleExportButton } from "@/components/editor/SubtitleExportButton";
import { HeaderOverflow } from "@/components/editor/HeaderOverflow";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { KeyboardShortcuts } from "@/components/editor/KeyboardShortcuts";
import { ShortcutHelp } from "@/components/editor/ShortcutHelp";
import { ProjectIO } from "@/components/editor/ProjectIO";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { ProjectStats } from "@/components/editor/ProjectStats";
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
import { ProjectDropImport } from "@/components/editor/ProjectDropImport";
import { PasteImage } from "@/components/editor/PasteImage";
import { PageTitleSync } from "@/components/editor/PageTitleSync";
import { SearchScenes } from "@/components/editor/SearchScenes";
import { useEditorStore } from "@/store/editor-store";
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
  const createProject = useProjectStore((s) => s.createProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const historyLen = useProjectStore((s) => s.history.length);
  const futureLen = useProjectStore((s) => s.future.length);
  const canUndo = historyLen > 0;
  const canRedo = futureLen > 0;
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const queueCount = useRenderQueueStore((s) => s.items.length);
  const toggleQueue = useRenderQueueStore((s) => s.togglePanel);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Chat is a floating widget now — defaults closed so the 3-column
  // editor (scenes | player | properties) gets the full screen on first
  // open. User opens via the bottom-right pill or Cmd+K.
  const [chatOpen, setChatOpenState] = useState(false);
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
      if (saved !== null) setChatOpenState(saved === "true");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  useEffect(() => {
    const handler = () => setTemplatePickerOpen(true);
    window.addEventListener("vibeedit:open-template-picker", handler);
    return () =>
      window.removeEventListener("vibeedit:open-template-picker", handler);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // ⌘, opens Settings — Mac convention.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "," ) {
        const t = e.target as HTMLElement | null;
        const inText =
          t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (inText) return;
        e.preventDefault();
        setSettingsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createProject]);
  // Layout: users can collapse the scene list / editor panels for focused
  // work. Persisted to localStorage so preference survives reloads.
  const [leftCollapsed, setLeftCollapsedState] = useState(false);
  const zenMode = useEditorStore((s) => s.zenMode);
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
  const agentStreaming = useChatStore((s) => s.isStreaming);

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
    <div
      className="flex flex-col h-screen text-neutral-100"
      style={{
        background:
          "linear-gradient(180deg, #0a0a0a 0%, #0a0a0a 60%, #060606 100%)",
      }}
    >
      <KeyboardShortcuts />
      <ShortcutHelp />
      <SearchScenes />
      <ProjectDropImport />
      <PasteImage />
      <PageTitleSync />
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-2 sm:px-4 py-2 gap-2 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md shrink-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(16,185,129,0.025) 0%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
            }}
            title="Show shortcuts"
            aria-label="Show shortcuts"
            className="shrink-0"
          >
            <Film className="h-5 w-5 text-emerald-400" aria-label="VibeEdit" />
          </button>
          <DevBadge />
          <ProjectSwitcher />
          <ProjectStats />
          <AspectSwitcher />
          {/* Uploads now happen per-scene — drop a file on a scene
              card or click "Upload to scene" inside it. The legacy
              topbar Uploads pop-out has been removed. */}
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
            <span className="hidden sm:inline text-[10px] font-mono text-neutral-500">⌘K</span>
            {agentStreaming && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
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
          {/* Chat-toggle stays accessible via Cmd+K. */}
          <button
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))
            }
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors text-sm font-mono"
          >
            ?
          </button>
          <MasterMixButton />
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings (API keys)"
            aria-label="Settings"
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
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
            <SubtitleExportButton />
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


      {/* Main layout — 3 columns: scenes | player | properties. Chat is
          a floating widget on top, not a column-stealer. */}
      <div className="flex flex-1 min-h-0">
        {/* Left: scene list (with expandable layers per card). */}
        {!zenMode && project.scenes.length > 0 && !leftCollapsed && (
          <div className="w-80 flex flex-col border-r-2 border-black shrink-0 overflow-hidden relative shadow-[3px_0_8px_-2px_rgba(0,0,0,0.7)]">
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

        {/* Right: properties panel — open whenever a scene is selected. */}
        {selectedSceneId &&
          project.scenes.some((s) => s.id === selectedSceneId) &&
          !rightCollapsed && (
            <div
              data-scene-editor
              className="w-72 border-l-2 border-black shrink-0 flex flex-col relative shadow-[-3px_0_8px_-2px_rgba(0,0,0,0.7)]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-emerald-500/30 bg-neutral-900 shrink-0">
                <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                  Properties
                </span>
                <button
                  onClick={() => setRightCollapsed(true)}
                  title="Collapse properties"
                  className="text-[10px] text-neutral-600 hover:text-white px-1"
                >
                  ›
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SceneEditor />
              </div>
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

      <ImageEditor />
      <RenderQueuePanel />
      <BulkActionsBar />
      <ScheduleRenderDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <ShortcutsOverlay />
      <WorkflowPicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Floating chat widget — fixed-positioned overlay, optional. */}
      {!zenMode && (
        <div
          className={`fixed top-14 right-4 bottom-4 z-50 transition-all duration-200 ${
            chatOpen
              ? "opacity-100 translate-x-0 pointer-events-auto"
              : "opacity-0 translate-x-6 pointer-events-none"
          }`}
          style={{ width: "min(420px, calc(100vw - 32px))" }}
        >
          <ChatSidebar
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            floating
          />
        </div>
      )}

      {/* Floating Vibe pill — appears when chat is closed. */}
      {!chatOpen && !zenMode && (
        <button
          onClick={() => setChatOpen(true)}
          title="Open Vibe AI (Cmd/Ctrl+K)"
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Vibe AI</span>
          <span className="text-[9px] font-mono bg-black/20 rounded px-1 py-0.5">
            ⌘K
          </span>
        </button>
      )}
    </div>
  );
}
