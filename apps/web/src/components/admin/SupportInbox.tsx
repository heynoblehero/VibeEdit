"use client";

import { useEffect, useRef, useState } from "react";

type ThreadSummary = {
  id: string;
  userId: string;
  subject: string | null;
  status: string;
  unreadForAdmin: boolean;
  unreadForUser: boolean;
  lastMessageAt: string | number | Date;
  createdAt: string | number | Date;
  userName: string | null;
  userEmail: string | null;
};

type Message = {
  id: string;
  threadId: string;
  sender: "user" | "admin";
  body: string;
  createdAt: string | number | Date;
};

function formatWhen(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function SupportInbox() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<ThreadSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    try {
      const response = await fetch("/api/admin/support", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { threads: ThreadSummary[] };
      setThreads(data.threads || []);
    } catch {
      // best-effort
    }
  }

  async function openThread(id: string) {
    setActiveId(id);
    try {
      const response = await fetch(`/api/admin/support/${id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { thread: ThreadSummary; messages: Message[] };
      setActive(data.thread);
      setMessages(data.messages || []);
      // Reflect the now-read state in the list without a full refetch.
      setThreads((prev) =>
        prev.map((thread) => (thread.id === id ? { ...thread, unreadForAdmin: false } : thread)),
      );
    } catch {
      // best-effort
    }
  }

  async function reply() {
    const body = draft.trim();
    if (!activeId || busy || body.length < 1) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${activeId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (response.ok) {
        setDraft("");
        await openThread(activeId);
        await loadThreads();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!activeId || !active) return;
    const next = active.status === "open" ? "closed" : "open";
    const response = await fetch(`/api/admin/support/${activeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) {
      setActive({ ...active, status: next });
      await loadThreads();
    }
  }

  useEffect(() => {
    void loadThreads();
    const timer = setInterval(() => void loadThreads(), 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex h-[34rem] gap-4">
      {/* Thread list */}
      <div className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {threads.length === 0 ? (
          <p className="p-4 text-xs text-[var(--color-fg-muted)]">No support threads yet.</p>
        ) : (
          <ul>
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  onClick={() => void openThread(thread.id)}
                  className={
                    "flex w-full flex-col gap-0.5 border-b border-[var(--color-border)] px-4 py-3 text-left transition hover:bg-[var(--color-bg)] " +
                    (activeId === thread.id ? "bg-[var(--color-bg)]" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {thread.userName || thread.userEmail || "Unknown user"}
                    </span>
                    {thread.unreadForAdmin && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    )}
                  </div>
                  <span className="truncate text-xs text-[var(--color-fg-muted)]">
                    {thread.userEmail}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                      {thread.status}
                    </span>
                    <span className="text-[10px] text-[var(--color-fg-muted)]">
                      {formatWhen(thread.lastMessageAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-fg-muted)]">
            Select a thread to view the conversation.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {active.userName || active.userEmail || "Unknown user"}
                </p>
                <p className="truncate text-xs text-[var(--color-fg-muted)]">{active.userEmail}</p>
              </div>
              <button
                onClick={() => void toggleStatus()}
                className="shrink-0 rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {active.status === "open" ? "Mark closed" : "Reopen"}
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={message.sender === "admin" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.sender === "admin"
                        ? "max-w-[80%] whitespace-pre-wrap break-words rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm text-black"
                        : "max-w-[80%] whitespace-pre-wrap break-words rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    }
                  >
                    {message.body}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-border)] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void reply();
                    }
                  }}
                  rows={1}
                  placeholder="Reply to this customer…"
                  className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  onClick={() => void reply()}
                  disabled={busy || draft.trim().length < 1}
                  className="rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
