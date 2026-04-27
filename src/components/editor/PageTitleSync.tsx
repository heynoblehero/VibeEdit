"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { onStorageFlush } from "@/store/throttled-storage";

/**
 * Keeps document.title in sync with the active project's name. Adds
 * a leading '•' when there are unflushed local changes so users see
 * at-a-glance whether their work is saved (a single tab, no save
 * indicator).
 */
export function PageTitleSync() {
  const name = useProjectStore((s) => s.project.name);
  const project = useProjectStore((s) => s.project);
  const [unsaved, setUnsaved] = useState(false);
  useEffect(() => {
    setUnsaved(true);
    return onStorageFlush(() => setUnsaved(false));
  }, [project]);
  useEffect(() => {
    const dot = unsaved ? "• " : "";
    document.title = name ? `${dot}${name} · VibeEdit` : "VibeEdit";
  }, [name, unsaved]);
  return null;
}
