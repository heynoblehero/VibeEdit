"use client";

import { useState, useEffect } from "react";

const SHORTCUTS = [
  { keys: "Space", action: "Play / Pause" },
  { keys: "S", action: "Split element at playhead" },
  { keys: "Delete", action: "Delete selected" },
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Shift+Z", action: "Redo" },
  { keys: "Ctrl+C", action: "Copy" },
  { keys: "Ctrl+V", action: "Paste" },
  { keys: "Ctrl+D", action: "Duplicate" },
  { keys: "\u2190/\u2192", action: "Frame step" },
  { keys: "Shift+\u2190/\u2192", action: "Jump 5 seconds" },
  { keys: "Home", action: "Go to start" },
  { keys: "End", action: "Go to end" },
  { keys: "?", action: "Show this help" },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md mx-4 w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h3>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{action}</span>
              <kbd className="text-xs bg-muted text-foreground px-2 py-0.5 rounded border border-border font-mono">{keys}</kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">Press ? to toggle this modal</p>
      </div>
    </div>
  );
}
