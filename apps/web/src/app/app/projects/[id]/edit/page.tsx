"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Chat } from "@/components/editor/Chat";
import { Preview } from "@/components/editor/Preview";
import { FilesDrawer } from "@/components/editor/FilesDrawer";
import { RenderPanel } from "@/components/editor/RenderPanel";
import { Wordmark } from "@/components/Wordmark";
import { UserMenu } from "@/components/UserMenu";
import { EditorTour } from "@/components/EditorTour";

type PageProps = { params: Promise<{ id: string }> };

type MobileTab = "chat" | "preview" | "files";

export default function EditorPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [showSaveSnippet, setShowSaveSnippet] = useState(false);
  const [toast, setToast] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && data.onboardingCompleted && !data.tourCompleted) setShowTour(true);
      })
      .catch(() => {
        /* onboarding fetch is best-effort — silently skip the tour */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    const source = new EventSource(`/api/projects/${id}/events`);
    // Multi-file-write turns (e.g. write_file + lint + screenshot) fire
    // several "change" events in quick succession. Coalesce them so the
    // preview remounts once per turn instead of N times.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        setReloadKey((k) => k + 1);
      }, 250);
    };
    source.addEventListener("change", onChange);
    return () => {
      if (pending) clearTimeout(pending);
      source.close();
    };
  }, [id, session]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("vibeedit:render"));
      } else if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("vibeedit:toggle-play"));
      } else if (event.key === "/") {
        event.preventDefault();
        setShowHelp((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </main>
    );
  }

  return (
    <main className="grid h-screen grid-rows-[auto_1fr] gap-0 pb-12 md:grid-cols-[380px_1fr_360px] md:pb-0">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 md:col-span-3">
        <div className="flex items-center gap-3">
          <Link href="/app/projects">
            <Wordmark size="sm" />
          </Link>
          <span className="hidden text-xs text-[var(--color-fg-muted)] sm:inline">/ editor</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            onClick={() => setShowSaveSnippet(true)}
            className="hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)] sm:inline-flex"
            title="Save this project's composition as a personal snippet"
          >
            ★ Save snippet
          </button>
          <RenderPanel projectId={id} />
          <UserMenu />
        </div>
      </header>

      <aside
        className={`${mobileTab === "chat" ? "flex" : "hidden"} h-full min-h-0 flex-col overflow-hidden border-r border-[var(--color-border)] md:flex`}
      >
        <Chat projectId={id} />
      </aside>
      <section
        className={`${mobileTab === "preview" ? "flex" : "hidden"} h-full min-h-0 flex-col overflow-hidden md:flex`}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <Preview projectId={id} reloadKey={reloadKey} />
        </div>
      </section>
      <aside
        className={`${mobileTab === "files" ? "block" : "hidden"} h-full min-h-0 overflow-y-auto border-l border-[var(--color-border)] md:block`}
      >
        <FilesDrawer projectId={id} reloadKey={reloadKey} />
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-bg)] md:hidden"
        aria-label="Editor tabs"
      >
        {(
          [
            {
              id: "chat",
              label: "Chat",
              icon: (
                <svg
                  width="20"
                  height="20"
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
              id: "preview",
              label: "Preview",
              icon: (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              ),
            },
            {
              id: "files",
              label: "Files",
              icon: (
                <svg
                  width="20"
                  height="20"
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
          ] as { id: MobileTab; label: string; icon: React.ReactNode }[]
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              mobileTab === id
                ? "border-t-2 border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)]"
                : "border-t-2 border-transparent text-[var(--color-fg-muted)]"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

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
      {toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg md:bottom-4 ${
            toast.kind === "ok"
              ? "border-[var(--color-success)] bg-[var(--color-surface)] text-[var(--color-fg)]"
              : "border-[var(--color-danger)] bg-[var(--color-surface)] text-[var(--color-danger)]"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

function SaveSnippetModal({
  projectId,
  onClose,
  onResult,
}: {
  projectId: string;
  onClose: () => void;
  onResult: (result: { kind: "ok" | "error"; text: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function save() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/snippets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, label: label.trim() }),
      });
      if (response.ok) {
        onResult({
          kind: "ok",
          text: `Saved to /app/snippets — "${label.trim()}"`,
        });
      } else {
        const data = (await response.json().catch(() => ({ error: response.statusText }))) as {
          error?: string;
        };
        onResult({
          kind: "error",
          text: `Couldn't save: ${data.error || "unknown error"}`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Save as snippet</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
          Saves this project's current index.html into your personal snippet library at
          /app/snippets — fork it into new projects anytime.
        </p>
        <input
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
          placeholder="Label (e.g. 'Comic intro v2')"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !label.trim()}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  const shortcuts: Array<[string, string]> = [
    ["Enter", "Send message"],
    ["Shift+Enter", "New line"],
    ["⌘ + R", "Render MP4"],
    ["⌘ + P", "Play / Pause preview"],
    ["⌘ + K", "Search projects + chats"],
    ["⌘ + /", "Show / hide this help"],
    ["Shift+click preview", "Edit scene at that frame"],
  ];
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Keyboard shortcuts</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <dt className="text-[var(--color-fg-muted)]">{desc}</dt>
              <dd>
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 font-mono text-xs">
                  {key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
