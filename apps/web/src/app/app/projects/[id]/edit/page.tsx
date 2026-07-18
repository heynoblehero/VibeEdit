"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Chat } from "@/components/editor/Chat";
import { FilesDrawer } from "@/components/editor/FilesDrawer";
import { EffectsPanel } from "@/components/editor/EffectsPanel";
import { KeySetupBanner } from "@/components/editor/KeySetupBanner";
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
  const [showTour, setShowTour] = useState(false);
  const [rightTab, setRightTab] = useState<"files" | "history" | "effects" | "code">("files");
  const [devMode, setDevMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [showSaveSnippet, setShowSaveSnippet] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
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

  // Fetch project name for breadcrumb. A missing project or one the user
  // doesn't own both come back 404 (the query is scoped to userId) — in either
  // case send them back to their dashboard instead of a dead "Loading…" state.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (r.status === 404 || r.status === 403) {
          if (!cancelled) router.replace("/app/projects");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!cancelled && data?.project?.name) setProjectName(data.project.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, session, router]);

  // Card thumbnail from the live preview: backfill once on open (if this
  // project has no recent thumbnail), then refresh after each agent edit so the
  // dashboard card always reflects the latest composition. Throttled + fire-
  // and-forget so it never blocks the editor.
  const lastThumbAt = useRef(0);
  useEffect(() => {
    if (!session) return;
    fetch(`/api/projects/${id}/thumb?ifMissing=1`, { method: "POST" }).catch(() => {});
  }, [id, session]);
  useEffect(() => {
    function onStatus(e: Event) {
      const detail = (e as CustomEvent<{ working: boolean }>).detail;
      if (detail?.working !== false) return;
      const now = Date.now();
      if (now - lastThumbAt.current < 45_000) return;
      lastThumbAt.current = now;
      fetch(`/api/projects/${id}/thumb`, { method: "POST" }).catch(() => {});
    }
    window.addEventListener("vibeedit:agent-status", onStatus);
    return () => window.removeEventListener("vibeedit:agent-status", onStatus);
  }, [id]);

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

        {/* Right: actions — kept minimal. Dev mode + Save snippet live in the ⋯ menu. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <RenderPanel projectId={id} />

          <div className="relative">
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              title="More"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {overflowOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setOverflowOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                >
                  <button
                    onClick={() => {
                      setShowSaveSnippet(true);
                      setOverflowOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
                  >
                    Save as snippet
                  </button>
                  <button
                    onClick={() => {
                      toggleDevMode();
                      setOverflowOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
                  >
                    Developer mode
                    <span
                      className={
                        devMode ? "text-[var(--color-accent)]" : "text-[var(--color-fg-subtle)]"
                      }
                    >
                      {devMode ? "On" : "Off"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          <UserMenu />
        </div>
      </header>

      {/* ── Chat panel (preview now lives inline in the thread) ── */}
      <aside
        className={`${mobileTab === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--color-bg)] md:flex`}
      >
        <KeySetupBanner />
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
          <button
            onClick={() => setRightTab("effects")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              rightTab === "effects"
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
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
            </svg>
            Effects
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
          ) : rightTab === "effects" ? (
            <EffectsPanel />
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
