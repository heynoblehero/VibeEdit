"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { Scene } from "@/lib/scene-schema";
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

// Translate a selectedLayerId into the patch that removes that one
// element from the scene. Returns null when the layer can't be deleted
// in isolation (e.g. voiceover handle — not yet supported here) so the
// caller can fall back to its previous behaviour.
function patchForLayerDelete(
  scene: Scene,
  layerId: string,
): { patch: Partial<Scene>; label: string } | null {
  if (layerId === "media:bg") {
    return {
      patch: {
        background: {
          ...scene.background,
          imageUrl: undefined,
          videoUrl: undefined,
        },
      },
      label: "Background",
    };
  }
  if (layerId === "media:character") {
    return {
      patch: { characterId: undefined, characterUrl: undefined },
      label: "Character",
    };
  }
  if (layerId.startsWith("media:broll:")) {
    const id = layerId.slice("media:broll:".length);
    return {
      patch: { broll: (scene.broll ?? []).filter((b) => b.id !== id) },
      label: "B-roll",
    };
  }
  if (layerId.startsWith("text-item:")) {
    const id = layerId.slice("text-item:".length);
    return {
      patch: { textItems: (scene.textItems ?? []).filter((t) => t.id !== id) },
      label: "Text",
    };
  }
  if (layerId.startsWith("shape:")) {
    const id = layerId.slice("shape:".length);
    return {
      patch: { shapes: (scene.shapes ?? []).filter((s) => s.id !== id) },
      label: "Shape",
    };
  }
  if (layerId === "text:main") {
    return { patch: { text: "" }, label: "Text" };
  }
  if (layerId === "text:emphasis") {
    return { patch: { emphasisText: "" }, label: "Emphasis" };
  }
  if (layerId === "text:subtitle") {
    return { patch: { subtitleText: "" }, label: "Subtitle" };
  }
  if (layerId.startsWith("effect:")) {
    const idx = Number(layerId.slice("effect:".length));
    if (!Number.isFinite(idx)) return null;
    const next = (scene.effects ?? []).filter((_, i) => i !== idx);
    return { patch: { effects: next }, label: "Effect" };
  }
  return null;
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

      // S (no modifier) — solo selected scene(s) (mute every other).
      // Press again with same selection → unmute everyone.
      if (!mod && (e.key === "s" || e.key === "S") && !isTextInput(e.target)) {
        const ids = selectedSceneIds.length > 0 ? selectedSceneIds : (selectedSceneId ? [selectedSceneId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        const all = useProjectStore.getState().project.scenes;
        const sel = new Set(ids);
        const isSoloed = all.every((sc) => (sel.has(sc.id) ? !sc.muted : sc.muted));
        for (const sc of all) {
          const wantMuted = isSoloed ? false : !sel.has(sc.id);
          if (!!sc.muted !== wantMuted) {
            useProjectStore.getState().updateScene(sc.id, { muted: wantMuted });
          }
        }
        toast(isSoloed ? "Solo cleared" : `Soloed ${ids.length}`, { duration: 700 });
        return;
      }

      // L (no modifier) — toggle lock on selected scene(s).
      if (!mod && (e.key === "l" || e.key === "L") && !isTextInput(e.target)) {
        const ids = selectedSceneIds.length > 0 ? selectedSceneIds : (selectedSceneId ? [selectedSceneId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        const scenes = useProjectStore.getState().project.scenes;
        const anyUnlocked = ids.some((id) => !scenes.find((s) => s.id === id)?.locked);
        for (const id of ids) {
          useProjectStore.getState().updateScene(id, { locked: anyUnlocked });
        }
        toast(anyUnlocked ? `Locked ${ids.length}` : `Unlocked ${ids.length}`, { duration: 700 });
        return;
      }

      // Z (no modifier) — toggle zen mode (chrome-hidden full-preview).
      if (!mod && (e.key === "z" || e.key === "Z") && !isTextInput(e.target)) {
        // Don't conflict with ⌘Z undo (handled below).
        e.preventDefault();
        const cur = useEditorStore.getState().zenMode;
        useEditorStore.getState().setZenMode(!cur);
        toast(cur ? "Editor restored" : "Zen mode (Z to exit)", { duration: 800 });
        return;
      }

      // [ / ] (no modifier) — set loop in / out at playhead.
      // \ clears the loop range. Gated against text inputs.
      if (!mod && !isTextInput(e.target)) {
        if (e.key === "[") {
          e.preventDefault();
          const f = useEditorStore.getState().previewFrame;
          useEditorStore.getState().setLoopStart(f);
          toast(`Loop in @ ${(f / 30).toFixed(2)}s`, { duration: 700 });
          return;
        }
        if (e.key === "]") {
          e.preventDefault();
          const f = useEditorStore.getState().previewFrame;
          useEditorStore.getState().setLoopEnd(f);
          toast(`Loop out @ ${(f / 30).toFixed(2)}s`, { duration: 700 });
          return;
        }
        if (e.key === "\\") {
          e.preventDefault();
          if (useEditorStore.getState().loopRange) {
            useEditorStore.getState().clearLoopRange();
            toast("Loop cleared", { duration: 700 });
          }
          return;
        }
      }

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

      // ⌘` cycles through projects in id order — quick way to jump
      // back to the previously-edited project without opening the
      // switcher.
      if (mod && e.key === "`" && !isTextInput(e.target)) {
        e.preventDefault();
        const st = useProjectStore.getState();
        const ids = Object.keys(st.projects);
        if (ids.length < 2) return;
        const idx = ids.indexOf(st.project.id);
        const next = ids[(idx + 1) % ids.length];
        if (next && next !== st.project.id) {
          st.switchProject(next);
          toast(`→ ${st.projects[next]?.name ?? "Project"}`, { duration: 700 });
        }
        return;
      }

      // ⌘⇧N — create a new blank project.
      if (mod && e.shiftKey && e.key.toLowerCase() === "n" && !isTextInput(e.target)) {
        e.preventDefault();
        const newId = useProjectStore.getState().createProject();
        useProjectStore.getState().switchProject(newId);
        toast("New project", { duration: 700 });
        return;
      }

      // ⌘⇧S — export the entire project as a downloadable JSON file.
      if (mod && e.shiftKey && e.key.toLowerCase() === "s" && !isTextInput(e.target)) {
        e.preventDefault();
        const project = useProjectStore.getState().project;
        const blob = new Blob([JSON.stringify(project, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9_-]+/gi, "_")}.vibeedit.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Project exported", { duration: 800 });
        return;
      }

      // ⌘C / ⌘V — copy / paste scene(s) as JSON via the clipboard.
      // Gated so we don't intercept regular copy when text is selected.
      if (mod && e.key.toLowerCase() === "c" && !e.shiftKey && !isTextInput(e.target)) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return; // user is copying text
        const ids = selectedSceneIds.length > 0 ? selectedSceneIds : (selectedSceneId ? [selectedSceneId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        const all = useProjectStore.getState().project.scenes;
        const picked = all.filter((s) => ids.includes(s.id));
        navigator.clipboard
          .writeText(JSON.stringify({ kind: "vibeedit:scenes", scenes: picked }))
          .then(() => toast(`Copied ${picked.length} scene${picked.length === 1 ? "" : "s"}`, { duration: 700 }))
          .catch(() => toast.error("Clipboard unavailable"));
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && !e.shiftKey && !isTextInput(e.target)) {
        e.preventDefault();
        navigator.clipboard
          .readText()
          .then((text) => {
            try {
              const parsed = JSON.parse(text);
              if (parsed?.kind !== "vibeedit:scenes" || !Array.isArray(parsed.scenes)) {
                toast.error("Clipboard isn't a scene snippet");
                return;
              }
              for (const sc of parsed.scenes) {
                const fresh = { ...sc, id: `scn-${Math.random().toString(36).slice(2, 10)}` };
                useProjectStore.getState().addScene(fresh);
              }
              toast(`Pasted ${parsed.scenes.length} scene${parsed.scenes.length === 1 ? "" : "s"}`, { duration: 800 });
            } catch {
              toast.error("Clipboard isn't valid JSON");
            }
          })
          .catch(() => toast.error("Clipboard unavailable"));
        return;
      }

      // ⌘⇧M — toggle mute on the selected scene(s).
      if (mod && e.shiftKey && e.key.toLowerCase() === "m" && !isTextInput(e.target)) {
        e.preventDefault();
        const ids = selectedSceneIds.length > 0 ? selectedSceneIds : (selectedSceneId ? [selectedSceneId] : []);
        if (ids.length === 0) return;
        const scenes = useProjectStore.getState().project.scenes;
        // If any selected scene is un-muted, mute them all; else unmute.
        const anyUnmuted = ids.some((id) => !scenes.find((s) => s.id === id)?.muted);
        for (const id of ids) {
          useProjectStore.getState().updateScene(id, { muted: anyUnmuted });
        }
        toast(anyUnmuted ? `Muted ${ids.length}` : `Unmuted ${ids.length}`, { duration: 700 });
        return;
      }

      // ⌘J / ⌘⇧J — jump playhead to next / prev marker. Wraps around.
      if (mod && e.key.toLowerCase() === "j" && !isTextInput(e.target)) {
        e.preventDefault();
        const markers = useProjectStore.getState().project.markers ?? [];
        if (markers.length === 0) return;
        const cur = useEditorStore.getState().previewFrame;
        const sorted = [...markers].sort((a, b) => a.frame - b.frame);
        const target = e.shiftKey
          ? [...sorted].reverse().find((m) => m.frame < cur) ?? sorted[sorted.length - 1]
          : sorted.find((m) => m.frame > cur) ?? sorted[0];
        window.dispatchEvent(
          new CustomEvent("vibeedit:seek-to", { detail: target.frame }),
        );
        return;
      }

      // ⌘⇧↑ / ⌘⇧↓ — bump selected scene's duration ±0.25s.
      if (
        mod &&
        e.shiftKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        !isTextInput(e.target) &&
        selectedSceneId
      ) {
        e.preventDefault();
        const sc = scenes.find((s) => s.id === selectedSceneId);
        if (!sc) return;
        const delta = e.key === "ArrowUp" ? 0.25 : -0.25;
        const next = Math.max(0.5, Math.min(60, Number((sc.duration + delta).toFixed(2))));
        useProjectStore.getState().updateScene(sc.id, { duration: next });
        toast(`${next.toFixed(2)}s`, { duration: 500 });
        return;
      }

      // ⌘[ / ⌘] AND ⌘↑ / ⌘↓ — move the selected scene one slot.
      const reorderUp =
        mod &&
        !isTextInput(e.target) &&
        (e.key === "[" || (e.key === "ArrowUp" && !e.shiftKey));
      const reorderDown =
        mod &&
        !isTextInput(e.target) &&
        (e.key === "]" || (e.key === "ArrowDown" && !e.shiftKey));
      if (reorderUp || reorderDown) {
        e.preventDefault();
        if (!selectedSceneId) return;
        const idx = scenes.findIndex((s) => s.id === selectedSceneId);
        if (idx < 0) return;
        const next = idx + (reorderDown ? 1 : -1);
        if (next < 0 || next >= scenes.length) return;
        useProjectStore.getState().moveScene(idx, next);
        return;
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
        // If a layer/item inside the scene is selected, Delete removes
        // *that* element — never the entire scene. Pressing Delete with
        // a text/shape/broll/bg selected used to wipe the scene, which
        // was a footgun.
        const layerId = useEditorStore.getState().selectedLayerId;
        if (layerId && selectedSceneId) {
          const scene = useProjectStore
            .getState()
            .project.scenes.find((s) => s.id === selectedSceneId);
          if (scene) {
            const action = patchForLayerDelete(scene, layerId);
            if (action) {
              e.preventDefault();
              useProjectStore
                .getState()
                .updateScene(selectedSceneId, action.patch);
              useEditorStore.getState().setSelectedLayerId(null);
              toast(`${action.label} removed`, { duration: 700 });
              return;
            }
          }
        }
        if (selectedSceneIds.length > 1) {
          e.preventDefault();
          // Confirm large deletes since Cmd+Z is the only escape hatch
          // and a misfire-while-having-many-scenes-selected wipes work.
          if (selectedSceneIds.length > 3) {
            const ok = window.confirm(
              `Delete ${selectedSceneIds.length} scenes? This is undoable with ⌘Z.`,
            );
            if (!ok) return;
          }
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
        // Layer first, then multi-scene selection — match the visual
        // hierarchy: a single press dismisses the resize chrome before
        // collapsing the scene-level selection.
        if (useEditorStore.getState().selectedLayerId) {
          useEditorStore.getState().setSelectedLayerId(null);
          useEditorStore.getState().setEditTarget(null);
        } else if (selectedSceneIds.length > 0) {
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

      // ⌘Enter — seek to selected scene's start + play.
      if (mod && e.key === "Enter" && !isTextInput(e.target) && selectedSceneId) {
        e.preventDefault();
        let acc = 0;
        for (const sc of scenes) {
          if (sc.id === selectedSceneId) break;
          acc += Math.round(sc.duration * useProjectStore.getState().project.fps);
        }
        window.dispatchEvent(
          new CustomEvent("vibeedit:seek-to", { detail: acc }),
        );
        useEditorStore.getState().setPaused(false);
        return;
      }

      // Home / End — seek to start / end of timeline. Plain keys, gated.
      if (
        (e.key === "Home" || e.key === "End") &&
        !mod &&
        !isTextInput(e.target)
      ) {
        e.preventDefault();
        // Dispatch via the existing seek-to channel.
        const target =
          e.key === "Home"
            ? 0
            : Math.max(0, useProjectStore.getState().project.scenes.reduce(
                (sum, s) => sum + Math.round(s.duration * useProjectStore.getState().project.fps),
                0,
              ) - 1);
        window.dispatchEvent(
          new CustomEvent("vibeedit:seek-to", { detail: target }),
        );
        return;
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
