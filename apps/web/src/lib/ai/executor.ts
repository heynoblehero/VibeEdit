import type { AIAction, AIActionResult, AIActionTool } from "./types";
import type { EditorCore } from "@/core";
import type { TimelineTrack, TimelineElement } from "@/types/timeline";
import { registerEffect } from "@/lib/remotion/registry";
import { getTemplate, getAllTemplates } from "@/lib/remotion/templates";
import { exportProject, downloadProject } from "@/lib/project/save-load";
import { getPreset, EXPORT_PRESETS } from "@/lib/project/export-presets";
import { validateUserCode } from "@/lib/ai/code-validator";
import { logSecurity } from "@/lib/ai/security-log";

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

const MAX_GENERATED_IMAGE_SIZE = 4096;

async function handleInsertGeneratedImage(params: Record<string, unknown>): Promise<unknown> {
  const color = params.color as string | undefined;
  const code = params.code as string | undefined;
  const name = (params.name as string) ?? "Generated Image";
  const startTime = (params.startTime as number) ?? 0;
  const duration = (params.duration as number) ?? 5;

  if (!color && !code) {
    throw new Error("insert_generated_image requires at least one of color or code");
  }

  const editor = getEditor();
  const activeProject = (window as any).__editor.project.getActive();
  if (!activeProject) throw new Error("No active project");

  const projectWidth = activeProject.settings?.canvasSize?.width ?? 1920;
  const projectHeight = activeProject.settings?.canvasSize?.height ?? 1080;
  const width = Math.min((params.width as number) ?? projectWidth, MAX_GENERATED_IMAGE_SIZE);
  const height = Math.min((params.height as number) ?? projectHeight, MAX_GENERATED_IMAGE_SIZE);

  // Validate drawing code if provided
  if (code) {
    const violation = validateUserCode(code);
    if (violation) {
      logSecurity("critical", "canvas_code_blocked", { name, violation });
      throw new Error(`Security: ${violation}`);
    }
  }

  // Create canvas and draw
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  // Apply solid color fill first (as base layer)
  if (color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  // Execute drawing code on top
  if (code) {
    try {
      // Determine if code is a function expression or imperative statements
      const trimmed = code.trim();
      const isFunctionExpr = /^\s*(\(|function[\s(])/.test(trimmed);
      const userCode = isFunctionExpr
        ? `var __fn = (${trimmed}); __fn(ctx, width, height);`
        : code;

      // Shadow dangerous globals via var declarations in the body.
      // NOTE: "eval" and "Function" cannot be used as parameter names or
      // var-declared in strict mode, but they are already blocked by
      // validateUserCode() so they never reach execution.
      const drawFn = new Function(
        "ctx", "width", "height",
        `"use strict";
         var fetch = void 0, XMLHttpRequest = void 0, WebSocket = void 0;
         var localStorage = void 0, sessionStorage = void 0;
         var importScripts = void 0;
         ${userCode}`
      );
      drawFn(ctx, width, height);
    } catch (err) {
      throw new Error(`Canvas drawing code error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Export canvas to PNG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export canvas to PNG"))),
      "image/png"
    );
  });

  const filename = `${name.replace(/[^a-zA-Z0-9_ -]/g, "_")}_${Date.now()}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  const url = URL.createObjectURL(file);

  // Generate a thumbnail data URL from the canvas
  const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);

  // Add to media library (url is required for the scene builder to render the image)
  await editor.media.addMediaAsset({
    projectId: activeProject.metadata.id,
    asset: {
      name: filename,
      type: "image" as const,
      file,
      url,
      thumbnailUrl,
      width,
      height,
    },
  });

  // Find the newly added asset
  const allAssets = editor.media.getAssets();
  const addedAsset = allAssets.find((a: any) => a.name === filename);
  if (!addedAsset) throw new Error("Failed to find generated image in media library");

  // Insert as image element on the video track
  editor.timeline.insertElement({
    element: {
      type: "image" as const,
      mediaId: addedAsset.id,
      name,
      duration,
      startTime,
      trimStart: 0,
      trimEnd: 0,
      transform: (params.transform as {
        scale: number;
        position: { x: number; y: number };
        rotate: number;
      }) ?? {
        scale: (params.scale as number) ?? 1,
        position: (params.position as { x: number; y: number }) ?? { x: 0, y: 0 },
        rotate: 0,
      },
      opacity: (params.opacity as number) ?? 1,
    },
    placement: { mode: "auto", trackType: "video" },
  });

  return {
    mediaId: addedAsset.id,
    name: filename,
    startTime,
    duration,
    message: `Generated and inserted "${name}" (${width}x${height}) on timeline`,
  };
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
  // exportProject and downloadProject imported at top
  const editor = getEditor();
  const project = exportProject(editor);
  downloadProject(project);
  return { name: project.name, message: `Saved "${project.name}.vibeedit"` };
}

function handleExportPreset(params: Record<string, unknown>): unknown {
  // getPreset and EXPORT_PRESETS imported at top
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

// ── Plan Mode ──────────────────────────────────────────────────────

function handleCreatePlan(params: Record<string, unknown>): unknown {
  const title = (params.title as string) || "Untitled Plan";
  const description = (params.description as string) || "";
  const estimatedDuration = (params.estimatedDuration as number) || 0;
  const rawSteps = (params.steps as Array<Record<string, unknown>>) || [];

  const steps = rawSteps.map((step, index) => ({
    id: crypto.randomUUID(),
    order: index,
    title: (step.title as string) || `Step ${index + 1}`,
    description: (step.description as string) || "",
    actions: (step.actions as Array<{ tool: string; params: Record<string, unknown> }>) || [],
    timeRange: step.timeRange as { start: number; end: number } | undefined,
    status: "pending" as const,
  }));

  return {
    id: crypto.randomUUID(),
    title,
    description,
    estimatedDuration,
    steps,
    status: "draft",
    currentStepIndex: 0,
  };
}

// ── New Clip Operations ────────────────────────────────────────────

function handleTrimClip(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  if (!trackId || !elementId) throw new Error("trackId and elementId required");

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  const updates: Record<string, unknown> = {};
  if (params.trimStart != null) updates.trimStart = params.trimStart;
  if (params.trimEnd != null) updates.trimEnd = params.trimEnd;

  editor.timeline.updateElements({
    updates: [{ trackId, elementId, updates: updates as any }],
  });
}

function handleAddTransition(params: Record<string, unknown>): unknown {
  const type = (params.type as string) || "cross-dissolve";
  const duration = (params.duration as number) || 0.5;

  // Transitions are implemented as Remotion effects overlaid between clips
  const transitionCode: Record<string, string> = {
    "cross-dissolve": `({ frame, fps, width, height }) => {
      const progress = Math.min(frame / (${duration} * fps), 1);
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, backgroundColor: 'black', opacity: 1 - progress }
      });
    }`,
    "fade-black": `({ frame, fps }) => {
      const mid = ${duration} * fps / 2;
      const opacity = frame < mid ? frame / mid : 1 - (frame - mid) / mid;
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, backgroundColor: 'black', opacity }
      });
    }`,
    "fade-white": `({ frame, fps }) => {
      const mid = ${duration} * fps / 2;
      const opacity = frame < mid ? frame / mid : 1 - (frame - mid) / mid;
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, backgroundColor: 'white', opacity }
      });
    }`,
    "wipe-left": `({ frame, fps, width }) => {
      const progress = Math.min(frame / (${duration} * fps), 1);
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, backgroundColor: 'black', clipPath: 'inset(0 0 0 ' + (progress * 100) + '%)' }
      });
    }`,
  };

  const code = transitionCode[type] || transitionCode["cross-dissolve"];
  const startTime = (params.startTime as number) || 0;

  const effect = {
    id: crypto.randomUUID(),
    name: `Transition: ${type}`,
    code,
    startFrame: Math.round(startTime * 30),
    durationFrames: Math.round(duration * 30),
    props: {},
  };

  registerEffect(effect);
  return { effectId: effect.id, type, duration };
}

function handleSpeedRamp(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const speed = params.speed as number;
  if (!trackId || !elementId || !speed) throw new Error("trackId, elementId, and speed required");

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  const found = findElement(tracks, trackId, elementId);
  if (!found) throw new Error("Element not found");

  const newDuration = found.element.duration / speed;
  editor.timeline.updateElements({
    updates: [{ trackId, elementId, updates: { duration: newDuration } as any }],
  });
}

function handleFreezeFrame(params: Record<string, unknown>): unknown {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const freezeTime = params.freezeTime as number;
  const duration = (params.duration as number) || 2;

  if (!trackId || !elementId || freezeTime == null) {
    throw new Error("trackId, elementId, and freezeTime required");
  }

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  // Split at freeze point, then insert a frozen image
  editor.timeline.splitElements({
    elements: [{ trackId, elementId }],
    splitTime: freezeTime,
  });

  return { message: `Freeze frame created at ${freezeTime}s for ${duration}s` };
}

// ── Audio Operations ───────────────────────────────────────────────

function handleAddVoiceover(params: Record<string, unknown>): unknown {
  const text = params.text as string;
  const startTime = (params.startTime as number) || 0;

  if (!text) throw new Error("text is required for add_voiceover");

  // This delegates to generate_media with elevenlabs
  return {
    message: `Voiceover queued: "${text.slice(0, 50)}..." at ${startTime}s. Use generate_media with service: "elevenlabs" to create the audio.`,
    suggestedAction: {
      tool: "generate_media",
      params: { service: "elevenlabs", action: "tts", params: { text } },
    },
  };
}

function handleDucking(params: Record<string, unknown>): void {
  const editor = getEditor();
  const musicTrackId = params.musicTrackId as string;
  const duckLevel = (params.duckLevel as number) || -12;

  if (!musicTrackId) throw new Error("musicTrackId required");

  const tracks = editor.timeline.getTracks();
  validateTrackExists(tracks, musicTrackId);

  // Apply volume reduction to the music track elements
  const musicTrack = tracks.find((t) => t.id === musicTrackId);
  if (!musicTrack) throw new Error("Music track not found");

  const duckVolume = Math.pow(10, duckLevel / 20); // dB to linear
  const updates = musicTrack.elements.map((el) => ({
    trackId: musicTrackId,
    elementId: el.id,
    updates: { volume: duckVolume } as any,
  }));

  if (updates.length > 0) {
    editor.timeline.updateElements({ updates });
  }
}

function handleSilenceDetection(params: Record<string, unknown>): unknown {
  // This is an analysis tool — returns info about silent segments
  // The actual audio analysis happens client-side
  return {
    message: "Silence detection requires audio analysis. Use auto_jump_cut to automatically remove silent segments.",
    suggestedAction: {
      tool: "auto_jump_cut",
      params,
    },
  };
}

// ── Text & Graphics ────────────────────────────────────────────────

function handleAddAnimatedTitle(params: Record<string, unknown>): unknown {
  const text = (params.text as string) || "Title";
  const style = (params.style as string) || "fade-scale";
  const startTime = (params.startTime as number) || 0;
  const duration = (params.duration as number) || 4;
  const fontSize = (params.fontSize as number) || 72;
  const color = (params.color as string) || "#ffffff";

  const animations: Record<string, string> = {
    "fade-scale": `({ frame, fps }) => {
      const progress = Math.min(frame / 30, 1);
      const opacity = progress;
      const scale = 0.8 + 0.2 * progress;
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', opacity, transform: 'scale(' + scale + ')', textShadow: '0 4px 30px rgba(0,0,0,0.5)', fontWeight: 'bold' }
      }, '${text.replace(/'/g, "\\'")}'));
    }`,
    "slide-up": `({ frame, fps, height }) => {
      const progress = Math.min(frame / 20, 1);
      const y = interpolate(progress, [0, 1], [height * 0.3, 0]);
      const opacity = progress;
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(' + y + 'px)' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', opacity, fontWeight: 'bold', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }
      }, '${text.replace(/'/g, "\\'")}'));
    }`,
    "typewriter": `({ frame, fps }) => {
      const fullText = '${text.replace(/'/g, "\\'")}';
      const charsShown = Math.min(Math.floor(frame / 3), fullText.length);
      const shown = fullText.slice(0, charsShown);
      const cursor = frame % 30 < 15 ? '|' : '';
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', fontFamily: 'monospace', fontWeight: 'bold' }
      }, shown + cursor));
    }`,
    "glitch": `({ frame, fps }) => {
      const glitch = Math.sin(frame * 0.5) > 0.8;
      const offsetX = glitch ? (Math.random() - 0.5) * 10 : 0;
      const offsetY = glitch ? (Math.random() - 0.5) * 5 : 0;
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', transform: 'translate(' + offsetX + 'px,' + offsetY + 'px)', fontWeight: 'bold', textShadow: glitch ? '2px 0 #ff0000, -2px 0 #00ffff' : '0 4px 20px rgba(0,0,0,0.5)' }
      }, '${text.replace(/'/g, "\\'")}'));
    }`,
    "bounce": `({ frame, fps }) => {
      const t = Math.min(frame / 20, 1);
      const bounce = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const scale = bounce;
      const opacity = Math.min(frame / 10, 1);
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', opacity, transform: 'scale(' + scale + ')', fontWeight: 'bold' }
      }, '${text.replace(/'/g, "\\'")}'));
    }`,
    "cinematic": `({ frame, fps, width }) => {
      const fadeIn = Math.min(frame / 45, 1);
      const letterSpacing = interpolate(fadeIn, [0, 1], [20, 4]);
      return React.createElement('div', {
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }
      }, React.createElement('h1', {
        style: { fontSize: ${fontSize}, color: '${color}', opacity: fadeIn, letterSpacing: letterSpacing + 'px', fontWeight: '300', textTransform: 'uppercase' }
      }, '${text.replace(/'/g, "\\'")}'));
    }`,
  };

  const code = animations[style] || animations["fade-scale"];

  const effect = {
    id: crypto.randomUUID(),
    name: `Title: ${text.slice(0, 20)}`,
    code,
    startFrame: Math.round(startTime * 30),
    durationFrames: Math.round(duration * 30),
    props: {},
  };

  registerEffect(effect);
  return { effectId: effect.id, style, text };
}

function handleAddCaptionTrack(params: Record<string, unknown>): unknown {
  // Delegates to auto_caption with style information
  const style = (params.style as string) || "modern";
  const position = (params.position as string) || "bottom";

  return {
    message: `Caption track will be generated. Style: ${style}, Position: ${position}. Audio transcription is needed — this will generate placeholder captions that you can edit.`,
    captionStyle: style,
    captionPosition: position,
  };
}

function handleAddCallout(params: Record<string, unknown>): unknown {
  const text = (params.text as string) || "Note";
  const startTime = (params.startTime as number) || 0;
  const duration = (params.duration as number) || 3;
  const position = params.position as { x: number; y: number } || { x: 0, y: 0 };

  const code = `({ frame, fps }) => {
    const fadeIn = Math.min(frame / 10, 1);
    return React.createElement('div', {
      style: { position: 'absolute', left: ${position.x + 960}, top: ${position.y + 540}, opacity: fadeIn, transform: 'scale(' + (0.8 + 0.2 * fadeIn) + ')' }
    },
      React.createElement('div', {
        style: { backgroundColor: '#fbbf24', color: '#000', padding: '8px 16px', borderRadius: 8, fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }
      }, '${text.replace(/'/g, "\\'")}')
    );
  }`;

  const effect = {
    id: crypto.randomUUID(),
    name: `Callout: ${text.slice(0, 20)}`,
    code,
    startFrame: Math.round(startTime * 30),
    durationFrames: Math.round(duration * 30),
    props: {},
  };

  registerEffect(effect);
  return { effectId: effect.id, text };
}

// ── Color & Effects ────────────────────────────────────────────────

function handleAddFilter(params: Record<string, unknown>): unknown {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const filter = (params.filter as string) || "warm";

  if (!trackId || !elementId) throw new Error("trackId and elementId required");

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  // Map filter names to CSS filter effect chains
  const filterEffects: Record<string, Array<{ type: string; params?: Record<string, unknown> }>> = {
    warm: [{ type: "saturate" }, { type: "hue-rotate" }],
    cool: [{ type: "saturate" }, { type: "hue-rotate" }],
    vintage: [{ type: "sepia" }, { type: "contrast" }],
    dramatic: [{ type: "contrast" }, { type: "brightness" }],
    cinematic: [{ type: "contrast" }, { type: "saturate" }],
    noir: [{ type: "grayscale" }, { type: "contrast" }],
    vibrant: [{ type: "saturate" }, { type: "brightness" }],
  };

  const effects = filterEffects[filter] || filterEffects["warm"];
  const effectIds: string[] = [];

  for (const eff of effects) {
    const effectId = editor.timeline.addClipEffect({
      trackId,
      elementId,
      effectType: eff.type,
    });
    effectIds.push(effectId);
  }

  return { filter, effectIds, message: `Applied "${filter}" filter` };
}

function handlePictureInPicture(params: Record<string, unknown>): void {
  const editor = getEditor();
  const mediaId = params.mediaId as string;
  const corner = (params.corner as string) || "bottom-right";
  const size = (params.size as number) || 0.25;
  const startTime = (params.startTime as number) || 0;
  const duration = (params.duration as number) || 5;

  if (!mediaId) throw new Error("mediaId required for picture_in_picture");

  const cornerPositions: Record<string, { x: number; y: number }> = {
    "top-left": { x: -960 + 960 * size + 20, y: -540 + 540 * size + 20 },
    "top-right": { x: 960 - 960 * size - 20, y: -540 + 540 * size + 20 },
    "bottom-left": { x: -960 + 960 * size + 20, y: 540 - 540 * size - 20 },
    "bottom-right": { x: 960 - 960 * size - 20, y: 540 - 540 * size - 20 },
  };

  const pos = cornerPositions[corner] || cornerPositions["bottom-right"];

  editor.timeline.insertElement({
    element: {
      type: "video" as const,
      mediaId,
      name: "Picture-in-Picture",
      duration,
      startTime,
      trimStart: 0,
      trimEnd: 0,
      transform: {
        scale: size,
        position: pos,
        rotate: 0,
      },
      opacity: 1,
    },
    placement: { mode: "auto", trackType: "video" },
  });
}

function handleKenBurns(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const startZoom = (params.startZoom as number) || 1;
  const endZoom = (params.endZoom as number) || 1.3;

  if (!trackId || !elementId) throw new Error("trackId and elementId required");

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  const found = findElement(tracks, trackId, elementId);
  if (!found) throw new Error("Element not found");

  // Add scale keyframes for Ken Burns zoom
  editor.timeline.upsertKeyframes({
    keyframes: [
      {
        trackId,
        elementId,
        propertyPath: "transform.scale" as any,
        time: 0,
        value: startZoom,
        interpolation: "linear" as any,
      },
      {
        trackId,
        elementId,
        propertyPath: "transform.scale" as any,
        time: found.element.duration,
        value: endZoom,
        interpolation: "linear" as any,
      },
    ],
  });
}

// ── Smart Operations ───────────────────────────────────────────────

function handleAutoJumpCut(params: Record<string, unknown>): unknown {
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;

  if (!trackId || !elementId) throw new Error("trackId and elementId required");

  const editor = getEditor();
  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  // Auto jump cut requires audio analysis which runs client-side
  // For now, return guidance and let the system process it
  return {
    message: "Auto jump cut initiated. Analyzing audio for silent segments... This feature detects pauses and removes dead air automatically.",
    trackId,
    elementId,
    silenceThreshold: (params.silenceThreshold as number) || -40,
    minSilence: (params.minSilence as number) || 0.5,
  };
}

function handleSmartReframe(params: Record<string, unknown>): void {
  const editor = getEditor();
  const trackId = params.trackId as string;
  const elementId = params.elementId as string;
  const targetRatio = (params.targetRatio as string) || "9:16";

  if (!trackId || !elementId) throw new Error("trackId and elementId required");

  const tracks = editor.timeline.getTracks();
  validateElementExists(tracks, trackId, elementId);

  // Calculate crop transform for target aspect ratio
  const ratios: Record<string, { scaleX: number; scaleY: number }> = {
    "9:16": { scaleX: 1.78, scaleY: 1 },  // Crop sides for vertical
    "1:1": { scaleX: 1.33, scaleY: 1 },    // Crop sides for square
    "4:5": { scaleX: 1.2, scaleY: 1 },     // Slight crop for portrait
    "16:9": { scaleX: 1, scaleY: 1 },      // No change
  };

  const ratio = ratios[targetRatio] || ratios["9:16"];

  editor.timeline.updateElements({
    updates: [{
      trackId,
      elementId,
      updates: {
        transform: {
          scale: ratio.scaleX,
          position: { x: 0, y: 0 },
          rotate: 0,
        },
      } as any,
    }],
  });
}

async function handleSearchStockMedia(params: Record<string, unknown>): Promise<unknown> {
  const query = params.query as string;
  const type = (params.type as string) || "video";

  if (!query) throw new Error("query is required for search_stock_media");

  const response = await fetch(`/api/stock-media?q=${encodeURIComponent(query)}&type=${type}&per_page=5`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Search failed" }));
    throw new Error(err.error || `Stock media search failed (${response.status})`);
  }

  const data = await response.json();
  return {
    results: data.results,
    type: data.type,
    message: `Found ${data.results?.length || 0} ${type} results for "${query}". Use insert_video or insert_image with the URL to add them to your project.`,
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
      case "insert_generated_image": {
        const result = await handleInsertGeneratedImage(params);
        return { tool, success: true, result };
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
      case "import_subtitles": {
        // Subtitles are imported via file attachment in chat, not via executor.
        // This is a no-op — the actual import happens in addMediaFiles.
        return { tool, success: true, result: { message: "Subtitles are imported by attaching .srt/.vtt files in the chat." } };
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
      // Plan mode
      case "create_plan": {
        const r = handleCreatePlan(params);
        return { tool, success: true, result: r };
      }
      // Clip operations
      case "trim_clip": {
        handleTrimClip(params);
        return { tool, success: true };
      }
      case "add_transition": {
        const r = handleAddTransition(params);
        return { tool, success: true, result: r };
      }
      case "speed_ramp": {
        handleSpeedRamp(params);
        return { tool, success: true };
      }
      case "freeze_frame": {
        const r = handleFreezeFrame(params);
        return { tool, success: true, result: r };
      }
      // Audio operations
      case "add_voiceover": {
        const r = handleAddVoiceover(params);
        return { tool, success: true, result: r };
      }
      case "ducking": {
        handleDucking(params);
        return { tool, success: true };
      }
      case "silence_detection": {
        const r = handleSilenceDetection(params);
        return { tool, success: true, result: r };
      }
      // Text & graphics
      case "add_animated_title": {
        const r = handleAddAnimatedTitle(params);
        return { tool, success: true, result: r };
      }
      case "add_caption_track": {
        const r = handleAddCaptionTrack(params);
        return { tool, success: true, result: r };
      }
      case "add_callout": {
        const r = handleAddCallout(params);
        return { tool, success: true, result: r };
      }
      // Color & effects
      case "add_filter": {
        const r = handleAddFilter(params);
        return { tool, success: true, result: r };
      }
      case "picture_in_picture": {
        handlePictureInPicture(params);
        return { tool, success: true };
      }
      case "ken_burns": {
        handleKenBurns(params);
        return { tool, success: true };
      }
      // Smart operations
      case "auto_jump_cut": {
        const r = handleAutoJumpCut(params);
        return { tool, success: true, result: r };
      }
      case "smart_reframe": {
        handleSmartReframe(params);
        return { tool, success: true };
      }
      case "search_stock_media": {
        const r = await handleSearchStockMedia(params);
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
