"use client";

import { BookmarkPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";
import { useSavedStylesStore } from "@/store/saved-styles-store";

export function SavedStylesPanel() {
  const project = useProjectStore((s) => s.project);
  const setCaptionStyle = useProjectStore((s) => s.setCaptionStyle);
  const setStylePack = useProjectStore((s) => s.setStylePack);
  const styles = useSavedStylesStore((s) => s.styles);
  const save = useSavedStylesStore((s) => s.save);
  const remove = useSavedStylesStore((s) => s.remove);

  const handleSave = () => {
    const name = window.prompt(
      "Name this style:",
      `${project.name} style`,
    );
    if (!name?.trim()) return;
    save({
      name: name.trim(),
      captionStyle: project.captionStyle,
      stylePack: project.stylePack,
      musicUrl: project.music?.url,
      musicName: project.music?.name,
    });
    toast.success("Style saved");
  };

  const handleApply = (id: string) => {
    const entry = styles.find((s) => s.id === id);
    if (!entry) return;
    if (entry.stylePack) setStylePack(entry.stylePack);
    if (entry.captionStyle)
      setCaptionStyle({
        ...entry.captionStyle,
      });
    toast.success(`Applied "${entry.name}"`, {
      description: entry.musicUrl
        ? "Music reference saved but not re-attached — add the file manually."
        : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">My styles</span>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
          title="Save current style"
        >
          <BookmarkPlus className="h-3 w-3" />
          Save current
        </button>
      </div>
      {styles.length === 0 ? (
        <div className="text-[10px] text-neutral-600 italic">
          No saved styles yet. Save this project's caption + palette for later reuse.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {styles.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2 py-1"
            >
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleApply(entry.id)}
                  className="text-xs text-white hover:text-emerald-300 truncate block text-left w-full"
                >
                  {entry.name}
                </button>
                <div className="flex items-center gap-1 mt-0.5">
                  {(entry.stylePack?.accentColors ?? []).slice(0, 4).map((c) => (
                    <div
                      key={c}
                      title={c}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => remove(entry.id)}
                className="opacity-0 group-hover:opacity-100 touch-reveal p-1 text-neutral-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
