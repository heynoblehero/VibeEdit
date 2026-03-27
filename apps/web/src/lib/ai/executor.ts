import type { AIAction, AIActionResult, AIActionTool } from "./types";
import type { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import { registerEffect } from "@/lib/remotion/registry";

function getEditor(): EditorCore {
  const editor = (window as any).__editor;
  if (!editor) {
    throw new Error("EditorCore not available on window.__editor");
  }
  return editor;
}

function findElement(
  tracks: TimelineTrack[],
  trackId: string,
  elementId: string
): { track: TimelineTrack; element: TimelineElement } | null {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;
  const element = track.elements.find(
    (e: TimelineElement) => e.id === elementId
  );
  if (!element) return null;
  return { track, element };
}

function validateTrackExists(tracks: TimelineTrack[], trackId: string): void {
  if (!tracks.find((t) => t.id === trackId)) {
    throw new Error(`Track not found: ${trackId}`);
  }
}

function validateElementExists(
  tracks: TimelineTrack[],
  trackId: string,
  elementId: string
): void {
  const result = findElement(tracks, trackId, elementId);
  if (!result) {
    throw new Error(
      `Element not found: ${elementId} on track ${trackId}`
    );
  }
}

function handleGetTimelineState(): unknown {
  const editor = getEditor();
  const tracks = editor.timeline.getTracks();
  const currentTime = editor.playback.getCurrentTime();
  const totalDuration = editor.timeline.getTotalDuration();

  return {
    tracks: tracks.map((track: TimelineTrack) => ({
      id: track.id,
      type: track.type,
      elements: track.elements.map((el: TimelineElement) => ({
        id: el.id,
        type: el.type,
        name: el.name,
        startTime: el.startTime,
        duration: el.duration,
        trimStart: el.trimStart,
        trimEnd: el.trimEnd,
        ...("mediaId" in el ? { mediaId: el.mediaId } : {}),
        ...("content" in el ? { content: el.content } : {}),
        ...("fontSize" in el ? { fontSize: el.fontSize } : {}),
        ...("fontFamily" in el ? { fontFamily: el.fontFamily } : {}),
        ...("color" in el ? { color: el.color } : {}),
        ...("transform" in el ? { transform: el.transform } : {}),
        ...("opacity" in el ? { opacity: el.opacity } : {}),
        ...("volume" in el ? { volume: el.volume } : {}),
      })),
      ...("muted" in track ? { muted: track.muted } : {}),
      ...("hidden" in track ? { hidden: track.hidden } : {}),
    })),
    currentTime,
    totalDuration,
  };
}

function handleGetMediaAssets(): unknown {
  const editor = getEditor();
  const assets = editor.media.getAssets();

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    type: asset.type,
    ...(asset.duration != null ? { duration: asset.duration } : {}),
    ...(asset.width != null ? { width: asset.width } : {}),
    ...(asset.height != null ? { height: asset.height } : {}),
  }));
}

function handleInsertText(params: Record<string, unknown>): void {
  const editor = getEditor();

  editor.timeline.insertElement({
    element: {
      type: "text" as const,
      content: (params.content as string) ?? "Text",
      fontSize: (params.fontSize as number) ?? 48,
      fontFamily: (params.fontFamily as string) ?? "Inter",
      color: (params.color as string) ?? "#ffffff",
      textAlign: (params.textAlign as "left" | "center" | "right") ?? "center",
      fontWeight: (params.fontWeight as "normal" | "bold") ?? "normal",
      fontStyle: (params.fontStyle as "normal" | "italic") ?? "normal",
      textDecoration:
        (params.textDecoration as "none" | "underline" | "line-through") ??
        "none",
      background: (params.background as { enabled: boolean; color: string }) ?? {
        enabled: false,
        color: "#000000",
      },
      name: (params.name as string) ?? (params.content as string) ?? "Text",
      duration: (params.duration as number) ?? 5,
      startTime: (params.startTime as number) ?? 0,
      trimStart: (params.trimStart as number) ?? 0,
      trimEnd: (params.trimEnd as number) ?? 0,
      transform: (params.transform as {
        scale: number;
        position: { x: number; y: number };
        rotate: number;
      }) ?? {
        scale: (params.scale as number) ?? 1,
        position: (params.position as { x: number; y: number }) ?? { x: 0, y: 0 },
        rotate: (params.rotate as number) ?? 0,
      },
      opacity: (params.opacity as number) ?? 1,
    },
    placement: { mode: "auto", trackType: "text" },
  });
}

function handleInsertVideo(params: Record<string, unknown>): void {
  const editor = getEditor();
  const mediaId = params.mediaId as string;
  if (!mediaId) throw new Error("mediaId is required for insert_video");

  editor.timeline.insertElement({
    element: {
      type: "video" as const,
      mediaId,
      name: (params.name as string) ?? "Video",
      duration: (params.duration as number) ?? 5,
      startTime: (params.startTime as number) ?? 0,
      trimStart: (params.trimStart as number) ?? 0,
      trimEnd: (params.trimEnd as number) ?? 0,
      transform: (params.transform as {
        scale: number;
        position: { x: number; y: number };
        rotate: number;
      }) ?? {
        scale: (params.scale as number) ?? 1,
        position: (params.position as { x: number; y: number }) ?? { x: 0, y: 0 },
        rotate: (params.rotate as number) ?? 0,
      },
      opacity: (params.opacity as number) ?? 1,
    },
    placement: { mode: "auto", trackType: "video" },
  });
}

function handleInsertImage(params: Record<string, unknown>): void {
  const editor = getEditor();
  const mediaId = params.mediaId as string;
  if (!mediaId) throw new Error("mediaId is required for insert_image");

  editor.timeline.insertElement({
    element: {
      type: "image" as const,
      mediaId,
      name: (params.name as string) ?? "Image",
      duration: (params.duration as number) ?? 5,
      startTime: (params.startTime as number) ?? 0,
      trimStart: (params.trimStart as number) ?? 0,
      trimEnd: (params.trimEnd as number) ?? 0,
      transform: (params.transform as {
        scale: number;
        position: { x: number; y: number };
        rotate: number;
      }) ?? {
        scale: (params.scale as number) ?? 1,
        position: (params.position as { x: number; y: number }) ?? { x: 0, y: 0 },
        rotate: (params.rotate as number) ?? 0,
      },
      opacity: (params.opacity as number) ?? 1,
    },
    placement: { mode: "auto", trackType: "video" },
  });
}

function handleInsertAudio(params: Record<string, unknown>): void {
  const editor = getEditor();
  const mediaId = params.mediaId as string;
  if (!mediaId) throw new Error("mediaId is required for insert_audio");

  editor.timeline.insertElement({
    element: {
      type: "audio" as const,
      sourceType: "upload" as const,
      mediaId,
      name: (params.name as string) ?? "Audio",
      duration: (params.duration as number) ?? 5,
      startTime: (params.startTime as number) ?? 0,
      trimStart: (params.trimStart as number) ?? 0,
      trimEnd: (params.trimEnd as number) ?? 0,
      volume: (params.volume as number) ?? 1,
    },
    placement: { mode: "auto", trackType: "audio" },
  });
}

function handleUpdateElement(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  if (!trackId || !elementId) {
    throw new Error("trackId and elementId are required for update_element");
  }

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  const updates = (params.updates as Record<string, unknown>) ?? {};

  editor.timeline.updateElements({
    updates: [
      {
        trackId,
        elementId,
        updates: updates as Partial<TimelineElement>,
      },
    ],
  });
}

function handleDeleteElements(params: Record<string, unknown>): void {
  const editor = getEditor();

  let elements: { trackId: string; elementId: string }[];

  if (Array.isArray(params.elements)) {
    elements = params.elements;
  } else if (params.trackId && params.elementId) {
    elements = [{
      trackId: params.trackId as string,
      elementId: params.elementId as string,
    }];
  } else {
    throw new Error("delete_elements requires elements array or trackId + elementId");
  }

  const tracks = editor.timeline.getTracks();
  for (const { trackId, elementId } of elements) {
    validateElementExists(tracks, trackId, elementId);
  }

  editor.timeline.deleteElements({ elements });
}

function handleMoveElement(params: Record<string, unknown>): void {
  const editor = getEditor();
  const sourceTrackId = params.sourceTrackId as string;
  const targetTrackId = params.targetTrackId as string;
  const elementId = params.elementId as string;
  const newStartTime = params.newStartTime as number;

  if (!sourceTrackId || !elementId || !targetTrackId || newStartTime == null) {
    throw new Error(
      "sourceTrackId, targetTrackId, elementId, and newStartTime are required for move_element"
    );
  }

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, sourceTrackId, elementId);
  validateTrackExists(tracks, targetTrackId);

  editor.timeline.moveElement({
    sourceTrackId,
    targetTrackId,
    elementId,
    newStartTime,
  });
}

function handleSplitElement(params: Record<string, unknown>): void {
  const editor = getEditor();
  const splitTime = params.splitTime as number | undefined;

  let elements: { trackId: string; elementId: string }[];

  if (Array.isArray(params.elements)) {
    elements = params.elements;
  } else if (params.trackId && params.elementId) {
    elements = [{
      trackId: params.trackId as string,
      elementId: params.elementId as string,
    }];
  } else {
    throw new Error("split_element requires trackId + elementId and splitTime");
  }

  if (splitTime == null) {
    throw new Error("splitTime is required for split_element");
  }

  const tracks = editor.timeline.getTracks();
  for (const { trackId, elementId } of elements) {
    validateElementExists(tracks, trackId, elementId);
  }

  editor.timeline.splitElements({ elements, splitTime });
}

function handleUpsertKeyframe(params: Record<string, unknown>): void {
  const editor = getEditor();

  // Support both formats:
  // 1. { keyframes: [...] }  (batched)
  // 2. { trackId, elementId, propertyPath, time, value } (single, from AI)
  let keyframes: Array<{
    trackId: string;
    elementId: string;
    propertyPath: string;
    time: number;
    value: unknown;
    interpolation?: string;
  }>;

  if (Array.isArray(params.keyframes)) {
    keyframes = params.keyframes;
  } else if (params.trackId && params.elementId && params.propertyPath != null) {
    // Single keyframe sent as flat params
    keyframes = [{
      trackId: params.trackId as string,
      elementId: params.elementId as string,
      propertyPath: params.propertyPath as string,
      time: params.time as number,
      value: params.value,
      interpolation: params.interpolation as string | undefined,
    }];
  } else {
    throw new Error("upsert_keyframe requires trackId, elementId, propertyPath, time, and value");
  }

  const tracks = editor.timeline.getTracks();
  for (const kf of keyframes) {
    validateElementExists(tracks, kf.trackId, kf.elementId);
  }

  editor.timeline.upsertKeyframes({
    keyframes: keyframes as Parameters<
      typeof editor.timeline.upsertKeyframes
    >[0]["keyframes"],
  });
}

function handleRemoveKeyframe(params: Record<string, unknown>): void {
  const editor = getEditor();

  let keyframes: Array<{
    trackId: string;
    elementId: string;
    propertyPath: string;
    keyframeId: string;
  }>;

  if (Array.isArray(params.keyframes)) {
    keyframes = params.keyframes;
  } else if (params.trackId && params.elementId && params.keyframeId && params.propertyPath) {
    keyframes = [{
      trackId: params.trackId as string,
      elementId: params.elementId as string,
      propertyPath: params.propertyPath as string,
      keyframeId: params.keyframeId as string,
    }];
  } else {
    throw new Error("remove_keyframe requires trackId, elementId, propertyPath, and keyframeId");
  }

  const tracks = editor.timeline.getTracks();
  for (const kf of keyframes) {
    validateElementExists(tracks, kf.trackId, kf.elementId);
  }

  editor.timeline.removeKeyframes({
    keyframes: keyframes as Parameters<
      typeof editor.timeline.removeKeyframes
    >[0]["keyframes"],
  });
}

function handleAddEffect(params: Record<string, unknown>): unknown {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const effectType = params.effectType as string;

  if (!trackId || !elementId || !effectType) {
    throw new Error(
      "trackId, elementId, and effectType are required for add_effect"
    );
  }

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  const effectId = editor.timeline.addClipEffect({
    trackId,
    elementId,
    effectType,
  });

  return { effectId };
}

function handleUpdateEffectParams(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const effectId = params.effectId as string;
  const effectParams = params.params as Record<string, unknown>;

  if (!trackId || !elementId || !effectId || !effectParams) {
    throw new Error(
      "trackId, elementId, effectId, and params are required for update_effect_params"
    );
  }

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  editor.timeline.updateClipEffectParams({
    trackId,
    elementId,
    effectId,
    params: effectParams as Parameters<
      typeof editor.timeline.updateClipEffectParams
    >[0]["params"],
  });
}

function handleSetPlayhead(params: Record<string, unknown>): void {
  const editor = getEditor();
  const time = params.time as number;

  if (time == null) {
    throw new Error("time is required for set_playhead");
  }

  editor.playback.seek({ time });
}

async function handleGenerateMedia(params: Record<string, unknown>): Promise<unknown> {
  const service = params.service as string;
  const action = params.action as string;
  const serviceParams = (params.params as Record<string, unknown>) || {};

  if (!service || !action) {
    throw new Error("generate_media requires service and action");
  }

  // Call the server-side API (API keys are managed server-side)
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, action, params: serviceParams }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Generation failed (${response.status})`);
  }

  const filename = response.headers.get("X-Filename") || "generated_media";
  const mimeType = response.headers.get("Content-Type") || "application/octet-stream";
  const blob = await response.blob();
  const file = new File([blob], filename, { type: mimeType });

  // Determine media type
  let mediaType: "audio" | "video" | "image" = "audio";
  if (mimeType.startsWith("image/")) mediaType = "image";
  else if (mimeType.startsWith("video/")) mediaType = "video";

  // Get duration for audio/video
  let duration: number | undefined;
  if (mediaType === "audio") {
    duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => { resolve(audio.duration); URL.revokeObjectURL(audio.src); };
      audio.onerror = () => resolve(0);
      audio.src = URL.createObjectURL(file);
    });
  }

  // Add to editor
  const editor = getEditor();
  const activeProject = (window as any).__editor.project.getActive();
  if (!activeProject) throw new Error("No active project");

  await editor.media.addMediaAsset({
    projectId: activeProject.metadata.id,
    asset: {
      name: filename,
      type: mediaType,
      file,
      duration,
    },
  });

  // Return info so AI can use the asset
  const allAssets = editor.media.getAssets();
  const addedAsset = allAssets.find((a: any) => a.name === filename);

  return {
    mediaId: addedAsset?.id,
    name: filename,
    type: mediaType,
    duration,
    message: `Generated and added ${filename} to project media`,
  };
}

function handleCreateRemotionEffect(params: Record<string, unknown>): unknown {
  const name = params.name as string;
  const startTime = params.startTime as number;
  const duration = params.duration as number;
  const code = params.code as string;

  if (!name || !code || startTime == null || duration == null) {
    throw new Error("create_remotion_effect requires name, startTime, duration, and code");
  }

  const fps = 30;
  const effect = {
    id: crypto.randomUUID(),
    name,
    code,
    startFrame: Math.round(startTime * fps),
    durationFrames: Math.round(duration * fps),
    props: {},
  };

  registerEffect(effect);
  return { effectId: effect.id, name, startFrame: effect.startFrame, durationFrames: effect.durationFrames };
}

function handleApplyLut(params: Record<string, unknown>): unknown {
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const lutId = params.lutId as string;

  if (!trackId || !elementId) {
    throw new Error("apply_lut requires trackId and elementId");
  }

  // For now, add as a custom effect — the actual LUT shader integration
  // would be done in the WebGL renderer. This stores the intent.
  const editor = getEditor();
  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  // Add as a clip effect with lut type
  const effectId = editor.timeline.addClipEffect({
    trackId,
    elementId,
    effectType: "lut",
  });

  if (lutId) {
    editor.timeline.updateClipEffectParams({
      trackId,
      elementId,
      effectId,
      params: { lutId },
    });
  }

  return { effectId, lutId };
}

async function handleAutoCaption(
  params: Record<string, unknown>
): Promise<unknown> {
  const { generatePlaceholderCaptions } = await import(
    "@/lib/media/auto-caption"
  );
  const duration = (params.duration as number) || 30;
  const segments = generatePlaceholderCaptions(duration);

  const editor = getEditor();
  for (const seg of segments) {
    editor.timeline.insertElement({
      element: {
        type: "text" as const,
        content: seg.text,
        fontSize: 32,
        fontFamily: "Inter",
        color: "#ffffff",
        textAlign: "center" as const,
        fontWeight: "bold" as const,
        fontStyle: "normal" as const,
        textDecoration: "none" as const,
        background: {
          enabled: true,
          color: "#000000",
          paddingX: 12,
          paddingY: 6,
          cornerRadius: 4,
          offsetX: 0,
          offsetY: 0,
        },
        name: `Caption ${seg.startTime}s`,
        duration: seg.endTime - seg.startTime,
        startTime: seg.startTime,
        trimStart: 0,
        trimEnd: 0,
        transform: { scale: 1, position: { x: 0, y: 350 }, rotate: 0 },
        opacity: 1,
      },
      placement: { mode: "auto", trackType: "text" },
    });
  }

  return {
    captions: segments.length,
    message: `Added ${segments.length} caption placeholders`,
  };
}

function handleUseTemplate(params: Record<string, unknown>): unknown {
  const {
    getTemplate,
    getAllTemplates,
  } = require("@/lib/remotion/templates");

  const templateId = params.templateId as string;
  const startTime = (params.startTime as number) ?? 0;
  const customProps = (params.customProps as Record<string, unknown>) || {};

  const template = getTemplate(templateId);
  if (!template) {
    const available = getAllTemplates().map(
      (t: any) => `${t.id}: ${t.name} (${t.category})`
    );
    throw new Error(
      `Template "${templateId}" not found. Available: ${available.join(", ")}`
    );
  }

  // Customize the template code by replacing default values with custom props
  let code = template.code;
  for (const [key, value] of Object.entries(customProps)) {
    if (typeof value === "string") {
      const regex = new RegExp(`const ${key} = "[^"]*"`, "g");
      code = code.replace(regex, `const ${key} = "${value}"`);
    } else if (typeof value === "number") {
      const regex = new RegExp(`const ${key} = \\d+`, "g");
      code = code.replace(regex, `const ${key} = ${value}`);
    }
  }

  const fps = 30;
  const effect = {
    id: crypto.randomUUID(),
    name: template.name,
    code,
    startFrame: Math.round(startTime * fps),
    durationFrames: Math.round(
      ((customProps.duration as number) || template.defaultDuration) * fps
    ),
    props: customProps,
  };

  registerEffect(effect);
  return { effectId: effect.id, template: template.name };
}

function handleUndo(): unknown {
  const editor = getEditor();
  editor.command.undo();
  return { message: "Undone" };
}

function handleRedo(): unknown {
  const editor = getEditor();
  editor.command.redo();
  return { message: "Redone" };
}

function handleBatchUpdate(params: Record<string, unknown>): unknown {
  const editor = getEditor();
  const filter = params.filter as Record<string, unknown> | undefined;
  const updates = params.updates as Record<string, unknown>;

  if (!updates) throw new Error("batch_update requires updates object");

  const tracks = editor.timeline.getTracks();
  const matchingElements: Array<{ trackId: string; elementId: string }> = [];

  for (const track of tracks) {
    for (const el of track.elements) {
      let matches = true;
      if (filter) {
        if (filter.type && el.type !== filter.type) matches = false;
        if (filter.name && !(el.name as string)?.includes(filter.name as string)) matches = false;
      }
      if (matches) {
        matchingElements.push({ trackId: track.id, elementId: el.id });
      }
    }
  }

  if (matchingElements.length === 0) {
    return { updated: 0, message: "No matching elements found" };
  }

  editor.timeline.updateElements({
    updates: matchingElements.map(({ trackId, elementId }) => ({
      trackId,
      elementId,
      updates: updates as any,
    })),
  });

  return { updated: matchingElements.length, message: `Updated ${matchingElements.length} elements` };
}

function handleSaveProject(): unknown {
  const { exportProject, downloadProject } = require("@/lib/project/save-load");
  const editor = getEditor();
  const project = exportProject(editor);
  downloadProject(project);
  return { name: project.name, message: `Saved "${project.name}.vibeedit"` };
}

function handleExportPreset(params: Record<string, unknown>): unknown {
  const { getPreset, EXPORT_PRESETS } = require("@/lib/project/export-presets");
  const presetId = params.presetId as string;

  if (!presetId) {
    // List available presets
    return {
      presets: EXPORT_PRESETS.map((p: any) => ({ id: p.id, name: p.name, platform: p.platform })),
      message: "Available export presets",
    };
  }

  const preset = getPreset(presetId);
  if (!preset) {
    return { error: `Unknown preset "${presetId}". Available: ${EXPORT_PRESETS.map((p: any) => p.id).join(", ")}` };
  }

  // Return the settings — the frontend export button handles the actual rendering
  return {
    preset: preset.name,
    settings: preset.settings,
    message: `Export settings ready for ${preset.name}. Use the Render button to start export.`,
  };
}

async function executeAction(action: AIAction): Promise<AIActionResult> {
  const { tool, params } = action;

  try {
    switch (tool) {
      case "get_timeline_state": {
        const data = handleGetTimelineState();
        return { tool, success: true, result: data };
      }
      case "get_media_assets": {
        const data = handleGetMediaAssets();
        return { tool, success: true, result: data };
      }
      case "insert_text": {
        handleInsertText(params);
        return { tool, success: true };
      }
      case "insert_video": {
        handleInsertVideo(params);
        return { tool, success: true };
      }
      case "insert_image": {
        handleInsertImage(params);
        return { tool, success: true };
      }
      case "insert_audio": {
        handleInsertAudio(params);
        return { tool, success: true };
      }
      case "update_element": {
        handleUpdateElement(params);
        return { tool, success: true };
      }
      case "delete_elements": {
        handleDeleteElements(params);
        return { tool, success: true };
      }
      case "move_element": {
        handleMoveElement(params);
        return { tool, success: true };
      }
      case "split_element": {
        handleSplitElement(params);
        return { tool, success: true };
      }
      case "upsert_keyframe": {
        handleUpsertKeyframe(params);
        return { tool, success: true };
      }
      case "remove_keyframe": {
        handleRemoveKeyframe(params);
        return { tool, success: true };
      }
      case "add_effect": {
        const result = handleAddEffect(params);
        return { tool, success: true, result };
      }
      case "update_effect_params": {
        handleUpdateEffectParams(params);
        return { tool, success: true };
      }
      case "set_playhead": {
        handleSetPlayhead(params);
        return { tool, success: true };
      }
      case "create_remotion_effect": {
        const result = handleCreateRemotionEffect(params);
        return { tool, success: true, result };
      }
      case "generate_media": {
        const result = await handleGenerateMedia(params);
        return { tool, success: true, result };
      }
      case "apply_lut": {
        const result = handleApplyLut(params);
        return { tool, success: true, result };
      }
      case "auto_caption": {
        const result = await handleAutoCaption(params);
        return { tool, success: true, result };
      }
      case "use_template": {
        const result = handleUseTemplate(params);
        return { tool, success: true, result };
      }
      case "undo": {
        const r = handleUndo();
        return { tool, success: true, result: r };
      }
      case "redo": {
        const r = handleRedo();
        return { tool, success: true, result: r };
      }
      case "batch_update": {
        const r = handleBatchUpdate(params);
        return { tool, success: true, result: r };
      }
      case "save_project": {
        const r = handleSaveProject();
        return { tool, success: true, result: r };
      }
      case "export_preset": {
        const r = handleExportPreset(params);
        return { tool, success: true, result: r };
      }
      default: {
        const unknownTool = tool as string;
        return {
          tool: unknownTool as AIActionTool,
          success: false,
          error: `Unknown action tool: ${unknownTool}`,
        };
      }
    }
  } catch (error) {
    return {
      tool,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeAIActions(actions: AIAction[]): Promise<AIActionResult[]> {
  const results: AIActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action);
    results.push(result);
  }

  return results;
}
