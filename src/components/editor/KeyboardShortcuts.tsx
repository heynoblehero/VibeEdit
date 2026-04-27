"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectedSceneIds = useProjectStore((s) => s.selectedSceneIds);
  const removeScene = useProjectStore((s) => s.removeScene);
  const removeScenes = useProjectStore((s) => s.removeScenes);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const scenes = useProjectStore((s) => s.project.scenes);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectAllScenes = useProjectStore((s) => s.selectAllScenes);

  const setCutMode = useEditorStore((s) => s.setCutMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // M — set marker at the current playhead frame. Plain key, gated
      // against text inputs. Pulls previewFrame from the editor store
      // (kept in sync by Preview's onFrameUpdate).
      if (!mod && (e.key === "m" || e.key === "M") && !isTextInput(e.target)) {
        e.preventDefault();
        const frame = useEditorStore.getState().previewFrame;
        const id = `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const colors = ["amber", "red", "green", "blue", "purple", "pink"] as const;
        const existingCount =
          useProjectStore.getState().project.markers?.length ?? 0;
        useProjectStore.getState().addMarker({
          id,
          frame,
          color: colors[existingCount % colors.length],
        });
        toast(`Marker @ ${(frame / 30).toFixed(2)}s`, { duration: 800 });
        return;
      }

      // C — toggle cut tool. V — selection mode (cut off). Premiere
      // convention. Plain keys; gated against text inputs so they don't
      // hijack typing in the chat / scene editor.
      if (!mod && !isTextInput(e.target)) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          const wasOn = useEditorStore.getState().cutMode;
          setCutMode(!wasOn);
          toast(wasOn ? "Selection mode" : "Cut tool active", { duration: 800 });
          return;
        }
        if (e.key === "v" || e.key === "V") {
          e.preventDefault();
          if (useEditorStore.getState().cutMode) {
            setCutMode(false);
            toast("Selection mode", { duration: 800 });
          }
          return;
        }
      }

      // Cmd+R — render with the current default preset. Browser's own
      // refresh shortcut is annoying inside an editor; we override it.
      if (mod && !e.shiftKey && e.key.toLowerCase() === "r" && !isTextInput(e.target)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("vibeedit:render-now"));
        toast("Rendering…", { duration: 1000 });
        return;
      }

      // Cmd+= / Cmd+- / Cmd+0 — timeline zoom in/out/fit. Gate against
      // text inputs so the user can still type a literal "+" in chat.
      if (mod && !isTextInput(e.target) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        const cur = useEditorStore.getState().timelineZoom;
        useEditorStore.getState().setTimelineZoom(cur * 1.5);
        return;
      }
      if (mod && !isTextInput(e.target) && e.key === "-") {
        e.preventDefault();
        const cur = useEditorStore.getState().timelineZoom;
        useEditorStore.getState().setTimelineZoom(cur / 1.5);
        return;
      }
      if (mod && !isTextInput(e.target) && e.key === "0") {
        e.preventDefault();
        useEditorStore.getState().setTimelineZoom(1);
        return;
      }

      if (mod && e.key.toLowerCase() === "z" && !isTextInput(e.target)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
          toast("Redo", { duration: 800 });
        } else {
          undo();
          toast("Undo", { duration: 800 });
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "y" && !isTextInput(e.target)) {
        e.preventDefault();
        redo();
        toast("Redo", { duration: 800 });
        return;
      }

      if (mod && /^[1-9]$/.test(e.key) && !isTextInput(e.target) && scenes.length > 0) {
        e.preventDefault();
        const idx = Math.min(scenes.length - 1, Number(e.key) - 1);
        selectScene(scenes[idx].id);
        return;
      }

      if (e.key === "g" && !mod && !isTextInput(e.target) && scenes.length > 0) {
        e.preventDefault();
        selectScene(scenes[0].id);
        return;
      }
      if (e.key === "G" && !isTextInput(e.target) && scenes.length > 0) {
        e.preventDefault();
        selectScene(scenes[scenes.length - 1].id);
        return;
      }

      if (e.key.toLowerCase() === "n" && !mod && !e.shiftKey && !isTextInput(e.target)) {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>('button[title="Add blank scene"]')
          ?.click();
        return;
      }

      if (mod && e.key.toLowerCase() === "a" && !isTextInput(e.target)) {
        if (scenes.length === 0) return;
        e.preventDefault();
        selectAllScenes();
        toast(`Selected ${scenes.length} scenes`, { duration: 700 });
        return;
      }

      if (mod && e.key.toLowerCase() === "d" && !isTextInput(e.target)) {
        e.preventDefault();
        if (selectedSceneId) {
          const newId = duplicateScene(selectedSceneId);
          if (newId) toast("Scene duplicated", { duration: 800 });
        }
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "c" && !isTextInput(e.target)) {
        // Cmd+Shift+C copies the selected scene's text content to clipboard.
        if (!selectedSceneId) return;
        const scene = scenes.find((s) => s.id === selectedSceneId);
        if (!scene) return;
        e.preventDefault();
        const text = [scene.text, scene.emphasisText, scene.subtitleText]
          .filter(Boolean)
          .join("\n");
        if (text) {
          navigator.clipboard?.writeText(text).catch(() => {});
          toast("Scene text copied", { duration: 800 });
        }
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isTextInput(e.target)
      ) {
        if (selectedSceneIds.length > 1) {
          e.preventDefault();
          removeScenes(selectedSceneIds);
          toast(`Deleted ${selectedSceneIds.length} scenes`, { duration: 900 });
          return;
        }
        if (selectedSceneId) {
          e.preventDefault();
          removeScene(selectedSceneId);
        }
      }

      if (e.key === "Escape" && !isTextInput(e.target)) {
        if (selectedSceneIds.length > 0) {
          clearSelection();
        }
      }

      // `E` focuses the first scene-editor field when a scene is selected.
      if (
        e.key.toLowerCase() === "e" &&
        !mod &&
        !e.shiftKey &&
        !isTextInput(e.target) &&
        selectedSceneId
      ) {
        e.preventDefault();
        const panel = document.querySelector<HTMLElement>(
          'aside[data-scene-editor], section[data-scene-editor], [data-scene-editor]',
        );
        const input = panel?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        );
        input?.focus();
      }

      // ←/→ — step the playhead by 1 frame (10 with Shift). Dispatched
      // as a CustomEvent so the Preview's playerRef can pick it up
      // without exposing the ref globally.
      if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !mod &&
        !isTextInput(e.target)
      ) {
        e.preventDefault();
        const delta = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1);
        window.dispatchEvent(
          new CustomEvent("vibeedit:seek-by", { detail: delta }),
        );
        return;
      }

      // Up/Down arrow and `,` / `.` navigate scene selection when not in an input.
      // Shift+Arrow extends the multi-selection in that direction.
      const isNavKey =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        (!mod && !e.shiftKey && (e.key === "," || e.key === "."));
      if (isNavKey && !isTextInput(e.target) && scenes.length > 0) {
        e.preventDefault();
        const dir = e.key === "ArrowDown" || e.key === "." ? 1 : -1;
        const currentIdx = selectedSceneId
          ? scenes.findIndex((s) => s.id === selectedSceneId)
          : -1;
        const nextIdx =
          currentIdx < 0
            ? dir > 0
              ? 0
              : scenes.length - 1
            : Math.max(0, Math.min(scenes.length - 1, currentIdx + dir));
        selectScene(scenes[nextIdx].id, e.shiftKey);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    scenes,
    selectScene,
    selectAllScenes,
    undo,
    redo,
    selectedSceneId,
    selectedSceneIds,
    removeScene,
    removeScenes,
    duplicateScene,
    clearSelection,
  ]);

  return null;
}
