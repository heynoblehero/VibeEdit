"use client";

import { useEffect, useRef, useState } from "react";

type SupportMessage = {
  id: string;
  threadId: string;
  sender: "user" | "admin";
  body: string;
  createdAt: string | number | Date;
};

type SupportThread = {
  id: string;
  subject: string | null;
  status: string;
  unreadForUser: boolean;
  lastMessageAt: string | number | Date;
  createdAt: string | number | Date;
  messages: SupportMessage[];
};

const POLL_MS = 15000;

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Flatten all messages across threads into one chronological transcript.
  const messages = threads
    .flatMap((thread) => thread.messages)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  async function load(markRead: boolean) {
    try {
      const response = await fetch("/api/support", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { threads: SupportThread[] };
      const list = data.threads || [];
      setThreads(list);
      // When the panel is open the GET already cleared unread server-side.
      if (markRead) {
        setUnread(false);
      } else {
        setUnread(list.some((thread) => thread.unreadForUser));
      }
    } catch {
      // best-effort
    }
  }

  // Poll for new admin replies while the user is signed in. When the panel is
  // open we refresh more directly; the GET marks the user side read.
  useEffect(() => {
    void load(open);
    const timer = setInterval(() => void load(open), POLL_MS);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  async function send() {
    const body = draft.trim();
    if (busy || body.length < 1) return;
    setBusy(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (response.ok) {
        setDraft("");
        await load(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-black shadow-lg transition hover:opacity-90"
        title="Chat with us"
        aria-label="Chat with us"
      >
        <svg
          width="22"
          height="22"
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
        {unread && !open && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-bg)] bg-red-500" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-bold">Chat with us</h3>
              <p className="text-xs text-[var(--color-fg-muted)]">We usually reply within a day.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              aria-label="Close support chat"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="mt-6 text-center text-xs text-[var(--color-fg-muted)]">
                Send us a message and the team will get back to you here.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={message.sender === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.sender === "user"
                        ? "max-w-[80%] whitespace-pre-wrap break-words rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm text-black"
                        : "max-w-[80%] whitespace-pre-wrap break-words rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    }
                  >
                    {message.body}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[var(--color-border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Type a message…"
                className="max-h-24 flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <button
                onClick={() => void send()}
                disabled={busy || draft.trim().length < 1}
                className="rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
