"use client";

import { Keyboard, X } from "lucide-react";
import { useEffect, useState } from "react";

const SHORTCUTS: Array<{ keys: string; label: string; scope: string }> = [
  { keys: "Cmd/Ctrl + Z", label: "Undo", scope: "Global" },
  { keys: "Shift + Cmd/Ctrl + Z", label: "Redo", scope: "Global" },
  { keys: "Cmd/Ctrl + Y", label: "Redo (alt)", scope: "Global" },
  { keys: "N", label: "New blank scene at end", scope: "Scenes" },
  { keys: ", / .", label: "Prev / next scene", scope: "Scenes" },
  { keys: "g / Shift+G", label: "Jump to first / last scene", scope: "Scenes" },
  { keys: "Cmd/Ctrl + A", label: "Select all scenes", scope: "Scenes" },
  { keys: "Cmd/Ctrl + D", label: "Duplicate selected scene", scope: "Scenes" },
  { keys: "Cmd/Ctrl + Shift + C", label: "Copy selected scene's text", scope: "Scenes" },
  { keys: "Delete / Backspace", label: "Delete selected scene(s)", scope: "Scenes" },
  { keys: "Shift-click / Cmd-click", label: "Multi-select scenes", scope: "Scenes" },
  { keys: "Right-click scene", label: "Context menu (edit / dup / copy / delete)", scope: "Scenes" },
  { keys: "Escape", label: "Clear selection (or cancel agent turn)", scope: "Scenes" },
  { keys: "Cmd/Ctrl + K", label: "Focus the vibe chat", scope: "Editor" },
  { keys: "Cmd/Ctrl + Shift + N", label: "Create project dialog", scope: "Editor" },
  { keys: "Cmd/Ctrl + R", label: "Ask the agent to try again differently", scope: "Editor" },
  { keys: "Cmd/Ctrl + Enter", label: "Generate scenes from script/topic", scope: "Editor" },
  { keys: "↑ / ↓", label: "Navigate scene selection", scope: "Scenes" },
  { keys: "Shift + ↑ / ↓", label: "Extend multi-selection during nav", scope: "Scenes" },
  { keys: "E", label: "Jump into the scene editor", scope: "Editor" },
  { keys: "Space", label: "Play / pause the preview", scope: "Editor" },
  { keys: "double-click scene", label: "Drop 'Edit scene N:' into chat", scope: "Scenes" },
  { keys: "/command", label: "Slash commands (/new, /render, /voice, /preset…)", scope: "Chat" },
  { keys: "?", label: "Show this overlay", scope: "Global" },
];

function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  );
}

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !isTextInput(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (open) {
        // Any other keystroke (including Escape) closes the overlay.
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const scopes = Array.from(new Set(SHORTCUTS.map((s) => s.scope)));

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Keyboard shortcuts</span>
          <span className="text-[10px] text-neutral-500">press ? to toggle</span>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto p-1 text-neutral-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {scopes.map((scope) => (
          <div key={scope} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              {scope}
            </span>
            {SHORTCUTS.filter((s) => s.scope === scope).map((s) => (
              <div key={s.keys} className="flex items-center gap-3 py-0.5">
                <kbd className="text-[10px] font-mono bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-neutral-300 min-w-[140px] text-center">
                  {s.keys}
                </kbd>
                <span className="text-xs text-neutral-300 flex-1">{s.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
