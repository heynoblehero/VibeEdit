"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Chat } from "@/components/editor/Chat";
import { FilesDrawer } from "@/components/editor/FilesDrawer";
import { EditHistory } from "@/components/editor/EditHistory";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { CodePane } from "@/components/editor/CodePane";
import { RenderPanel } from "@/components/editor/RenderPanel";
import { Wordmark } from "@/components/Wordmark";
import { UserMenu } from "@/components/UserMenu";
import { EditorTour } from "@/components/EditorTour";

type PageProps = { params: Promise<{ id: string }> };
type MobileTab = "chat" | "files";

export default function EditorPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [rightTab, setRightTab] = useState<"files" | "history" | "code">("files");
  const [devMode, setDevMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [showSaveSnippet, setShowSaveSnippet] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(h);
  }, [toast]);

  // Surface notices dispatched by child panels (e.g. RenderPanel render errors).
  useEffect(() => {
    function onNotify(e: Event) {
      const d = (e as CustomEvent<{ kind: "ok" | "error"; text: string }>).detail;
      if (d?.text) setToast({ kind: d.kind, text: d.text });
    }
    window.addEventListener("vibeedit:notify", onNotify);
    return () => window.removeEventListener("vibeedit:notify", onNotify);
  }, []);

  // Asset surfaces (Files panel / picker modal) fire this when they hand an
  // edit to the agent, so mobile jumps to the chat to show it running.
  useEffect(() => {
    function onFocusChat() {
      setMobileTab("chat");
    }
    window.addEventListener("vibeedit:focus-chat", onFocusChat);
    return () => window.removeEventListener("vibeedit:focus-chat", onFocusChat);
  }, []);

  // Fetch project name for breadcrumb
  useEffect(() => {
    if (!session) return;
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.project?.name) setProjectName(data.project.name);
      })
      .catch(() => {});
  }, [id, session]);

  // Show "Saved" pulse when agent stops working
  useEffect(() => {
    let h: ReturnType<typeof setTimeout>;
    function onStatus(e: Event) {
      const detail = (e as CustomEvent<{ working: boolean }>).detail;
      if (!detail?.working) {
        setSavedPulse(true);
        h = setTimeout(() => setSavedPulse(false), 2000);
      }
    }
    window.addEventListener("vibeedit:agent-status", onStatus);
    return () => {
      window.removeEventListener("vibeedit:agent-status", onStatus);
      clearTimeout(h);
    };
  }, []);

  // Tour
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.onboardingCompleted && !data.tourCompleted) setShowTour(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Auth redirect
  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  // File-change SSE → reload preview + badge the Preview tab on mobile.
  useEffect(() => {
    if (!session) return;
    const source = new EventSource(`/api/projects/${id}/events`);
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        setReloadKey((k: number) => k + 1);
      }, 250);
    };
    source.addEventListener("change", onChange);
    return () => {
      if (pending) clearTimeout(pending);
      source.close();
    };
  }, [id, session]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("vibeedit:render"));
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("vibeedit:toggle-play"));
      } else if (e.key === "/") {
        e.preventDefault();
        setShowHelp((v: boolean) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load/save dev mode from localStorage so the preference survives refreshes.
  useEffect(() => {
    setDevMode(localStorage.getItem("vibeedit:devmode") === "1");
  }, []);

  function toggleDevMode() {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem("vibeedit:devmode", next ? "1" : "0");
    if (!next && rightTab === "code") setRightTab("files");
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-fg-muted)]">Loading editor…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="grid h-[100dvh] grid-rows-[auto_1fr] gap-0 overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:grid-cols-[1fr_360px] md:pb-0">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 md:col-span-2 md:px-4">
        {/* Left: logo + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/app/projects" className="shrink-0 transition-opacity hover:opacity-80">
            <Wordmark size="sm" compactBadge />
          </Link>
          {/* Separator + project name */}
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M4 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="hidden max-w-[180px] truncate font-medium text-[var(--color-fg-muted)] sm:block"
              title={projectName ?? ""}
            >
              {projectName ?? "Loading…"}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Dev mode toggle */}
          <button
            onClick={toggleDevMode}
            title={devMode ? "Disable developer mode" : "Enable developer mode (shows code editor)"}
            className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:inline-flex ${
              devMode
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
            }`}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Dev
          </button>

          {/* Save snippet */}
          <button
            onClick={() => setShowSaveSnippet(true)}
            title="Save as snippet"
            className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-2)] hover:text-[var(--color-fg)] sm:inline-flex"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Save snippet</span>
          </button>

          {savedPulse && (
            <span className="hidden items-center gap-1 text-[10px] font-medium text-[var(--color-success)] sm:flex">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
              Saved
            </span>
          )}

          <RenderPanel projectId={id} />
          <UserMenu />
        </div>
      </header>

      {/* ── Chat panel (preview now lives inline in the thread) ── */}
      <aside
        className={`${mobileTab === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--color-bg)] md:flex`}
      >
        <Chat projectId={id} reloadKey={reloadKey} />
      </aside>

      {/* ── Right panel: Files + History tabs ──────────────────── */}
      <aside
        className={`${mobileTab === "files" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg)] md:flex`}
      >
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          <button
            onClick={() => setRightTab("files")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              rightTab === "files"
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]"
                : "border-b-2 border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            <svg
              width="12"
              height="12"
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
            Files
          </button>
          <button
            onClick={() => setRightTab("history")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              rightTab === "history"
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]"
                : "border-b-2 border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
            History
          </button>
          {devMode && (
            <button
              onClick={() => setRightTab("code")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                rightTab === "code"
                  ? "border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]"
                  : "border-b-2 border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Code
            </button>
          )}
        </div>

        {/* Panel content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rightTab === "files" ? (
            <>
              <EditHistory projectId={id} />
              <FilesDrawer projectId={id} reloadKey={reloadKey} />
            </>
          ) : rightTab === "history" ? (
            <HistoryPanel
              projectId={id}
              reloadKey={reloadKey}
              onRestored={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <CodePane projectId={id} reloadKey={reloadKey} />
          )}
        </div>
      </aside>

      {/* ── Mobile tab bar ─────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
        aria-label="Editor tabs"
      >
        {[
          {
            id: "chat" as MobileTab,
            label: "Chat",
            icon: (
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            ),
          },
          {
            id: "files" as MobileTab,
            label: "Files",
            icon: (
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
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            ),
          },
        ].map(({ id: tabId, label, icon }) => (
          <button
            key={tabId}
            onClick={() => setMobileTab(tabId)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              mobileTab === tabId
                ? "border-t-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-t-2 border-transparent text-[var(--color-fg-muted)]"
            }`}
          >
            <span className="relative">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* ── Modals ─────────────────────────────────────────────── */}
      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
      {showTour && <EditorTour onDone={() => setShowTour(false)} />}
      {showSaveSnippet && (
        <SaveSnippetModal
          projectId={id}
          onClose={() => setShowSaveSnippet(false)}
          onResult={(result) => {
            setShowSaveSnippet(false);
            setToast(result);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 animate-slide-up rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl md:bottom-5 ${
            toast.kind === "ok"
              ? "border-[var(--color-success)]/40 bg-[var(--color-surface)] text-[var(--color-success)]"
              : "border-[var(--color-danger)]/40 bg-[var(--color-surface)] text-[var(--color-danger)]"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

/* ── ShortcutsModal ───────────────────────────────────────────────────────── */
function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const shortcuts = [
    { keys: "⌘ R", label: "Render MP4" },
    { keys: "⌘ P", label: "Play / Pause preview" },
    { keys: "⌘ K", label: "Search projects & chats" },
    { keys: "⌘ /", label: "Keyboard shortcuts" },
    { keys: "Enter", label: "Send message" },
    { keys: "⇧ Enter", label: "New line in message" },
    { keys: "⇧ Click", label: "Edit scene at frame" },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <ul className="py-2">
          {shortcuts.map(({ keys, label }) => (
            <li key={keys} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-sm text-[var(--color-fg-muted)]">{label}</span>
              <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-0.5 font-mono text-xs text-[var(--color-fg)]">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── SaveSnippetModal ─────────────────────────────────────────────────────── */
function SaveSnippetModal({
  projectId,
  onClose,
  onResult,
}: {
  projectId: string;
  onClose: () => void;
  onResult: (r: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function save() {
    setBusy(true);
    const r = await fetch("/api/snippets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, label: label.trim() }),
    });
    setBusy(false);
    if (r.ok) onResult({ kind: "ok", text: "Snippet saved to /app/snippets" });
    else onResult({ kind: "error", text: "Could not save snippet" });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">Save as snippet</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
            Label (optional)
          </label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="e.g. Finance hook 30s"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
          />
          <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
            Saves the current index.html. Find it at{" "}
            <Link href="/app/snippets" className="text-[var(--color-accent)] hover:underline">
              /app/snippets
            </Link>
            .
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-2)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save snippet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
