"use client";

import { useEffect, useState } from "react";

export function BugReport() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  async function submit() {
    if (busy || description.trim().length < 5) return;
    setBusy(true);
    try {
      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: typeof window !== "undefined" ? window.location.href : "",
          description: description.trim(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      });
      if (response.ok) {
        setSent(true);
        setDescription("");
        setTimeout(() => {
          setOpen(false);
          setSent(false);
        }, 1500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-fg-muted)] shadow-lg hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] md:flex md:bottom-4"
        title="Report a bug"
        aria-label="Report a bug"
      >
        bug
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Report a bug</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                ✕
              </button>
            </div>
            {sent ? (
              <p className="text-sm text-[var(--color-success)]">
                Got it — thanks. We read every report.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
                  What broke? We capture the current URL + your browser automatically. We do NOT
                  capture the screen.
                </p>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  placeholder="When I clicked Render, the progress bar got stuck at 30% and never moved…"
                  className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy || description.trim().length < 5}
                    className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
