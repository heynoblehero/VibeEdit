"use client";

import { CalendarClock, Film, ListVideo, MessageCircle, Redo2, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AuthBar } from "@/components/editor/AuthBar";
import { BatchVariantsButton } from "@/components/editor/BatchVariantsButton";
import { BridgeIndicator } from "@/components/editor/BridgeIndicator";
import { DevBadge } from "@/components/editor/DevBadge";
import { ProjectHome } from "@/components/editor/ProjectHome";
import { BulkActionsBar } from "@/components/editor/BulkActionsBar";
import { ChatSidebar } from "@/components/editor/ChatSidebar";
import { ClipTrimPanel } from "@/components/editor/ClipTrimPanel";
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
import { ThumbnailExporter } from "@/components/editor/ThumbnailExporter";
import { SceneEditor } from "@/components/editor/SceneEditor";
import { SceneList } from "@/components/editor/SceneList";
import { ShortcutsOverlay } from "@/components/editor/ShortcutsOverlay";
import { ScheduleRenderDialog } from "@/components/editor/ScheduleRenderDialog";
import { SceneToolsPanel } from "@/components/editor/SceneToolsPanel";
import { WorkflowBadge } from "@/components/editor/WorkflowBadge";
import { WorkflowInputs } from "@/components/editor/WorkflowInputs";
import { useChatStore } from "@/store/chat-store";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";
import { totalDurationSeconds } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";

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
  const canUndo = useProjectStore((s) => s.history.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const queueCount = useRenderQueueStore((s) => s.items.length);
  const toggleQueue = useRenderQueueStore((s) => s.togglePanel);
  const dur = totalDurationSeconds(project.scenes);
  const workflow = getWorkflow(project.workflowId);

  // Chat-first: the modal picker no longer auto-opens. The chat sidebar's
  // empty state shows workflow cards inline. The picker is still reachable
  // via the WorkflowBadge in the header for users who want the full view.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Always start `true` so SSR and first client render agree. A post-mount
  // effect collapses the sidebar on narrow screens — avoids hydration mismatch.
  const [chatOpen, setChatOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // First-run landing: show ProjectHome instead of the editor when the user
  // hasn't engaged yet (current project is empty + never dismissed).
  const [homeDismissed, setHomeDismissed] = useState(false);
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
        setChatOpen(true);
        setTimeout(() => {
          const input = document.querySelector<HTMLTextAreaElement>(
            'aside textarea',
          );
          input?.focus();
        }, 50);
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
            onClick={() => {
              // Synthesize a "?" keydown to open the shortcuts overlay.
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "?" }),
              );
            }}
            title="Keyboard shortcuts"
            className="shrink-0"
          >
            <Film className="h-5 w-5 text-emerald-400" aria-label="VibeEdit" />
          </button>
          <DevBadge />
          <ProjectSwitcher />
          <WorkflowBadge />
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
              title="Undo (Cmd/Ctrl+Z)"
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Shift+Cmd/Ctrl+Z)"
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          {/* Auto-video button retired — the chat agent handles "make a video about X" natively. */}
          <button
            onClick={toggleQueue}
            title="Render queue"
            className="relative p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ListVideo className="h-4 w-4" />
            {queueCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-emerald-500 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </button>
          <span className="text-xs text-neutral-500">
            {project.scenes.length} scenes &middot; {dur.toFixed(1)}s
          </span>
          <BridgeIndicator />
          <SaveIndicator />
          <HeaderOverflow>
            <AuthBar />
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
        {project.scenes.length > 0 && (
          <div className="w-80 flex flex-col border-r border-neutral-800 shrink-0 overflow-hidden">
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
              {advancedOpen && (
                <div className="border-t border-neutral-800">
                  <WorkflowInputs workflow={workflow} />
                  {workflow.id === "commentary" && <ClipTrimPanel slotId="clips" />}
                </div>
              )}
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full px-4 py-1.5 text-[10px] text-neutral-600 hover:text-neutral-300 border-t border-neutral-800 text-left"
              >
                {advancedOpen ? "Hide" : "Show"} workflow inputs
              </button>
            </details>
          </div>
        )}

        {/* Center: preview */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          <div className="flex-1 min-h-0">
            <Preview />
          </div>
        </div>

        {/* Right: scene editor — only when a scene is selected */}
        {selectedSceneId && project.scenes.some((s) => s.id === selectedSceneId) && (
          <div
            data-scene-editor
            className="w-72 border-l border-neutral-800 shrink-0 overflow-y-auto"
          >
            <SceneEditor />
          </div>
        )}
      </div>
      )}

      <ImageEditor />
      <RenderQueuePanel />
      <BulkActionsBar />
      <ScheduleRenderDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <ShortcutsOverlay />
    </div>
  );
}
