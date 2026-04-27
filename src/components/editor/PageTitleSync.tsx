"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/store/project-store";

/**
 * Keeps document.title in sync with the active project's name. Lets
 * users distinguish multiple editor tabs at a glance.
 */
export function PageTitleSync() {
  const name = useProjectStore((s) => s.project.name);
  useEffect(() => {
    const original = document.title;
    document.title = name ? `${name} · VibeEdit` : "VibeEdit";
    return () => {
      document.title = original;
    };
  }, [name]);
  return null;
}
