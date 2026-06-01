"use client";

import { useEffect, useRef, useState } from "react";

export function CodePane({ projectId, reloadKey }: { projectId: string; reloadKey: number }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/files/index.html`)
      .then((r) => {
        if (!r.ok) return null;
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setCode(text);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startEdit() {
    if (!code) return;
    setEditValue(code);
    setEditMode(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/file`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "index.html", content: editValue }),
      });
      setCode(editValue);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  function editInChat() {
    window.dispatchEvent(
      new CustomEvent("vibeedit:edit-asset", { detail: { path: "index.html" } }),
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-fg-muted)]">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
        <span className="ml-2">Loading…</span>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-2xl text-[var(--color-fg-subtle)]">&lt;/&gt;</div>
        <p className="text-xs text-[var(--color-fg-muted)]">
          No composition yet. Ask the agent to build one.
        </p>
      </div>
    );
  }

  const lineCount = code.split("\n").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-fg-muted)]">
          <span className="font-mono text-[var(--color-fg)]">index.html</span>
          <span>· {lineCount} lines</span>
        </div>
        <div className="flex items-center gap-1.5">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="rounded px-2 py-1 text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-[10px] font-semibold text-black disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={copy}
                title="Copy to clipboard"
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button
                onClick={editInChat}
                title="Edit in chat"
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
              >
                Edit in chat
              </button>
              <button
                onClick={startEdit}
                title="Edit directly"
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {editMode ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-[var(--color-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-fg)] outline-none"
        />
      ) : (
        <pre className="min-h-0 flex-1 overflow-auto bg-[var(--color-bg)] p-3 font-mono text-[11px] leading-relaxed">
          <HtmlHighlight code={code} />
        </pre>
      )}
    </div>
  );
}

function HtmlHighlight({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="mr-4 w-8 shrink-0 select-none text-right text-[var(--color-fg-subtle)]">
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlightHtmlLine(line) }} />
          {"\n"}
        </div>
      ))}
    </>
  );
}

function highlightHtmlLine(line: string): string {
  return line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(&lt;\/?)([\w-]+)/g, '<span style="color:var(--color-accent)">$1$2</span>')
    .replace(
      /([\w-]+=)(&quot;[^&]*&quot;|"[^"]*")/g,
      '<span style="color:var(--color-fg-muted)">$1</span><span style="color:var(--color-success)">$2</span>',
    )
    .replace(/(\/\/.*$)/g, '<span style="color:var(--color-fg-subtle)">$1</span>')
    .replace(/(&lt;!--.*?--&gt;)/g, '<span style="color:var(--color-fg-subtle)">$1</span>');
}
