// Shared helpers for the asset surfaces (right-panel FilesDrawer + composer
// AssetPickerModal): how to classify an asset, which internal files to hide,
// and the "Edit with AI" quick actions that hand a real instruction to the
// agent (which already has the full footage pipeline).

export type AssetKind = "image" | "video" | "audio" | "other";
export type AssetSource = "upload" | "ai";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|m4a|flac)$/i;

export function assetKind(path: string): AssetKind {
  if (IMAGE_EXT.test(path)) return "image";
  if (VIDEO_EXT.test(path)) return "video";
  if (AUDIO_EXT.test(path)) return "audio";
  return "other";
}

// Internal/derived files that shouldn't appear in the media grid: provenance
// manifest, voiceover word-timings, transcript caches, and caption/data files.
export function isNoiseAsset(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  if (name.startsWith(".")) return true;
  if (/\.timestamps\.json$/i.test(name)) return true;
  if (path.includes("assets/processed/transcripts/")) return true;
  if (/\.(json|srt|vtt|txt)$/i.test(name)) return true;
  return false;
}

export type EditAction =
  // "send" fires the instruction straight to the agent; "prefill" drops a
  // starter into the chat box for the user to finish typing.
  { label: string; mode: "send" | "prefill"; text: string };

export function editActionsFor(path: string): EditAction[] {
  const kind = assetKind(path);
  const ref = `\`${path}\``;

  if (kind === "video") {
    return [
      {
        label: "Trim silence + filler",
        mode: "send",
        text: `Edit ${ref}: transcribe it, then cut every filler word ("um", "uh") and silence longer than 0.4s on clean word boundaries. Use your footage pipeline (probe_clip → plan_edit → render_edl), then verify the output.`,
      },
      {
        label: "Add captions",
        mode: "send",
        text: `Edit ${ref}: transcribe it and burn in synced captions — 2 words at a time, uppercase, white text on a semi-transparent black pill. Render to assets/processed/.`,
      },
      {
        label: "Color grade",
        mode: "send",
        text: `Edit ${ref}: apply an auto exposure/colour correction plus a warm cinematic grade, and render the graded clip to assets/processed/.`,
      },
      {
        label: "Speed ramp",
        mode: "send",
        text: `Edit ${ref}: speed-ramp the slow sections to ~2–3× and snap back to 1× at the action moments. Render to assets/processed/.`,
      },
      { label: "Custom edit…", mode: "prefill", text: `Edit ${ref} — ` },
    ];
  }

  if (kind === "audio") {
    return [
      {
        label: "Trim + normalize",
        mode: "send",
        text: `Edit ${ref}: trim leading/trailing silence and normalize loudness to −14 LUFS. Save to assets/processed/.`,
      },
      {
        label: "Use as music track",
        mode: "send",
        text: `Add ${ref} as the background music track for the composition, ducked under any narration.`,
      },
      { label: "Custom edit…", mode: "prefill", text: `Edit ${ref} — ` },
    ];
  }

  if (kind === "image") {
    return [
      {
        label: "Use in composition",
        mode: "send",
        text: `Use ${ref} in the composition where it fits (background or overlay) and wire it into the timeline.`,
      },
      { label: "Custom edit…", mode: "prefill", text: `Edit ${ref} — ` },
    ];
  }

  return [{ label: "Custom edit…", mode: "prefill", text: `Edit ${ref} — ` }];
}

// Dispatches an asset edit action: either sends a prompt to the agent or
// pre-fills the chat box, and asks the editor to surface the chat (mobile).
export function runAssetAction(action: EditAction, path: string): void {
  if (action.mode === "send") {
    window.dispatchEvent(
      new CustomEvent("vibeedit:send-prompt", { detail: { text: action.text } }),
    );
  } else {
    window.dispatchEvent(new CustomEvent("vibeedit:edit-asset", { detail: { path } }));
  }
  window.dispatchEvent(new CustomEvent("vibeedit:focus-chat"));
}
