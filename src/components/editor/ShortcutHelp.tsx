"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Keyboard shortcut cheat sheet. Mounts hidden; press `?` (or `/`) to
 * open. Pure-info — listing what's already wired in KeyboardShortcuts.
 */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inText =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (!inText && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] overflow-auto bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 sticky top-0 bg-neutral-950">
          <h2 className="text-sm font-semibold text-neutral-200">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
          {SECTIONS.map((sect) => (
            <div key={sect.title} className="mb-3">
              <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
                {sect.title}
              </div>
              <div className="space-y-0.5">
                {sect.rows.map(([keys, desc]) => (
                  <div key={keys} className="flex items-baseline gap-2">
                    <kbd className="font-mono text-[10px] text-neutral-300 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {keys}
                    </kbd>
                    <span className="text-neutral-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SECTIONS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: "Project",
    rows: [
      ["⌘ Z", "undo"],
      ["⌘ ⇧ Z / ⌘ Y", "redo"],
      ["⌘ S", "save (autosave is always on)"],
      ["⌘ ⇧ S", "export project as JSON"],
      ["⌘ K", "toggle AI chat sidebar"],
      ["⌘ P", "project switcher"],
      ["⌘ ⇧ N", "new blank project"],
      ["⌘ R", "render with the current preset"],
      ["⌘ ⇧ E", "export current frame as poster (PNG)"],
      ["⌘ ⇧ C", "copy selected scene's text"],
      ["⌘ C / ⌘ V", "copy / paste scenes via clipboard"],
      ["⌘ V (image)", "paste clipboard image as new scene"],
      ["⌘ M", "open master mix popover"],
      ["⌘ F", "search scene text"],
      ["Z", "zen mode (chrome-hidden preview)"],
      ["L", "toggle lock on selection"],
    ],
  },
  {
    title: "Timeline",
    rows: [
      ["C", "cut tool — click to split"],
      ["V", "selection mode (cut off)"],
      ["M", "marker at the playhead"],
      ["⌘ J / ⌘ ⇧ J", "next / prev marker"],
      ["⌘ =", "zoom in"],
      ["⌘ −", "zoom out"],
      ["⌘ 0", "fit-to-width"],
      ["Space", "play / pause"],
      ["[", "loop in-point at playhead"],
      ["]", "loop out-point at playhead"],
      ["\\", "clear loop range"],
      ["⌘ [ / ⌘ ]", "reorder selected scene up / down"],
    ],
  },
  {
    title: "Scenes",
    rows: [
      ["⌘ 1-9", "jump to scene N"],
      ["g / G", "first / last scene"],
      ["↑ / ↓", "previous / next scene"],
      ["⌘ A", "select all"],
      ["⌘ D", "duplicate selected"],
      ["N", "new blank scene"],
      ["⌘ ↑ / ⌘ ↓", "reorder selected scene"],
      ["⌘ ⇧ ↑ / ⌘ ⇧ ↓", "trim selected scene's duration ±0.25s"],
      ["⌘ ⇧ M", "toggle mute on selection"],
      ["Delete / Backspace", "delete selected"],
      ["Esc", "clear selection"],
      ["Double-click block", "rename"],
      ["Right-click block", "context menu (mute, solo, tag, lock, AI)"],
    ],
  },
  {
    title: "Drag & drop",
    rows: [
      ["Drop file from Finder", "uploads + inserts as new scene"],
      ["Drag upload onto timeline", "insert as a new scene"],
      ["⇧ + drag upload onto scene", "swap that scene's bg media"],
      ["Drag effect / look / title", "drop on a scene"],
      ["Drag transition", "drop between scenes"],
    ],
  },
  {
    title: "Misc",
    rows: [
      ["?", "this dialog"],
      ["Alt + drag trim", "free-snap (bypass grid)"],
      ["Alt + click marker", "remove marker"],
    ],
  },
];
