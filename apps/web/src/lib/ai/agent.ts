import { query } from "@anthropic-ai/claude-agent-sdk";
import { ALLOWED_TOOL_NAMES, MCP_SERVER_NAME, buildToolServer, type ToolContext } from "./tools";
import { buildSystemPrompt, type BrandKitContext } from "./system-prompt";
import { listFiles } from "../storage/fs";
import { assetSummaryLines } from "../storage/manifests";
import { db } from "@/lib/db";
import { creatorInsights, userPreferences, brandKits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { captureException } from "@/lib/observability/sentry";
import { captureEvent, FUNNEL } from "@/lib/observability/posthog";
import { readModelPreferences, resolveModelForTask, type ModelPreferences } from "./model-prefs";

// First-draft compositions need the strongest planner; incremental edits
// route to Sonnet to cut cost ~3-4× without losing edit quality.
const FIRST_DRAFT_MODEL = "claude-opus-4-8";
const EDIT_MODEL = "claude-sonnet-4-6";
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL;

function pickModel(userId: string, projectId: string, prefs: ModelPreferences): string {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE;
  // The agent loop runs on the claude-agent-sdk, which only supports Claude
  // models. In Manual mode, honor a Claude brain choice; a non-Claude brain
  // pick (e.g. grok) can't drive this runtime, so we fall through to the
  // auto first-draft/edit routing rather than failing.
  if (prefs.mode === "manual") {
    const chosen = resolveModelForTask("brain", prefs);
    if (chosen && chosen.provider === "anthropic") return chosen.id;
  }
  try {
    const files = listFiles(userId, projectId);
    const hasComposition = files.some(
      (path) => path === "index.html" || path.endsWith("/index.html"),
    );
    return hasComposition ? EDIT_MODEL : FIRST_DRAFT_MODEL;
  } catch {
    return FIRST_DRAFT_MODEL;
  }
}

export type ToolResultImage = {
  data: string;
  mimeType: "image/png" | "image/jpeg";
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
  | {
      type: "tool_result";
      tool_use_id: string;
      result: string;
      images?: ToolResultImage[];
    }
  // Structured tool-lifecycle events for live activity UI. These are emitted
  // ALONGSIDE the existing tool_use / tool_result events (never instead of
  // them), so any consumer that ignores them keeps working exactly as before.
  // `label` is a pre-computed human-readable description ("Searching b-roll…").
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; name: string; ok: boolean }
  | { type: "turn_end"; usage?: unknown }
  | { type: "done"; stop_reason: string }
  | { type: "error"; message: string };

type AssistantContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
};

type SdkMessage = {
  type: string;
  message?: { content?: AssistantContentBlock[] };
  result?: string;
  subtype?: string;
  usage?: unknown;
};

function loadUserInsights(userId: string): string | undefined {
  try {
    const rows = db.select().from(creatorInsights).where(eq(creatorInsights.userId, userId)).all();
    if (rows.length === 0) return undefined;
    return rows
      .sort((a, b) => b.confidence - a.confidence)
      .map((row) => `${row.key} (confidence ${row.confidence.toFixed(2)}): ${row.value}`)
      .join("\n");
  } catch {
    return undefined;
  }
}

function loadBrandKit(userId: string): BrandKitContext | undefined {
  try {
    const row = db.select().from(brandKits).where(eq(brandKits.userId, userId)).get();
    if (!row) return undefined;
    const hasAny =
      row.channelName ||
      row.primaryColor ||
      row.accentColor ||
      row.fontFamily ||
      row.hostName ||
      row.hostDescription ||
      row.toneVoice ||
      row.targetAudience ||
      row.logoPath ||
      row.watermarkPath;
    if (!hasAny) return undefined;
    return {
      channelName: row.channelName,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      fontFamily: row.fontFamily,
      hostName: row.hostName,
      hostDescription: row.hostDescription,
      toneVoice: row.toneVoice,
      targetAudience: row.targetAudience,
      logoPath: row.logoPath,
      watermarkPath: row.watermarkPath,
      voiceId: row.voiceId,
    };
  } catch {
    return undefined;
  }
}

function loadUserPrefs(userId: string): {
  niche?: string;
  formatPreference?: string;
  postFrequency?: string;
} {
  try {
    const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
    return {
      niche: row?.niche ?? undefined,
      formatPreference: row?.formatPreference ?? undefined,
      postFrequency: row?.postFrequency ?? undefined,
    };
  } catch {
    return {};
  }
}

// Hard cap on tool-use turns per chat request. Complex compositions with
// many asset downloads + retries can burn through 30 turns before writing.
// 60 gives room for: plan + 10 download attempts + write + lint + screenshot.
const MAX_TURNS = 60;

export async function runAgent(opts: {
  userMessage: string;
  priorHistory?: string;
  ctx: ToolContext;
  onEvent: (event: AgentEvent) => void;
  abortController?: AbortController;
}): Promise<void> {
  // Defensive: never log raw keys server-side. They live on ctx.apiKeys for
  // this single run and never get serialized into messages/history.
  if (opts.ctx.apiKeys) {
    Object.freeze(opts.ctx.apiKeys);
  }
  const server = buildToolServer(opts.ctx);
  // Always tell the AI what assets exist and what to call them — the "name" is
  // the chat handle the user points at. Full detail is pulled via read_manifest.
  const assetLines = assetSummaryLines(opts.ctx.userId, opts.ctx.projectId);
  const assetBlock = assetLines.length
    ? `Project assets (refer to each by its name; call read_manifest for full detail before editing):\n${assetLines.map((l) => `- ${l}`).join("\n")}\n\n`
    : "";
  const prefix = opts.priorHistory
    ? `Prior conversation context:\n${opts.priorHistory}\n\nNew user message:\n`
    : "";
  const modelPreferences = readModelPreferences(opts.ctx.userId);
  const model = pickModel(opts.ctx.userId, opts.ctx.projectId, modelPreferences);
  const insights = loadUserInsights(opts.ctx.userId);
  const prefs = loadUserPrefs(opts.ctx.userId);
  const brandKit = loadBrandKit(opts.ctx.userId);

  // Funnel: every agent run is a message the user sent to the AI.
  captureEvent(FUNNEL.messageSent, opts.ctx.userId, {
    projectId: opts.ctx.projectId,
    model,
  });

  // Wrap the caller's onEvent so we can observe the stream for funnel signals
  // (plan tools = the user reached the planning step) and surface tool errors
  // to Sentry — without touching individual tool implementations.
  let planEmitted = false;
  const onEvent = (event: AgentEvent) => {
    if (
      !planEmitted &&
      event.type === "tool_use" &&
      (event.name === "plan_composition" || event.name === "plan_edit")
    ) {
      planEmitted = true;
      captureEvent(FUNNEL.planApproved, opts.ctx.userId, {
        projectId: opts.ctx.projectId,
        tool: event.name,
      });
    }
    opts.onEvent(event);
  };

  try {
    const byokKey = opts.ctx.apiKeys?.anthropic;
    const agentEnv: Record<string, string | undefined> = { ...process.env };
    if (byokKey) agentEnv.ANTHROPIC_API_KEY = byokKey;

    for await (const message of query({
      prompt: assetBlock + prefix + opts.userMessage,
      options: {
        systemPrompt: buildSystemPrompt({
          insights,
          brandKit,
          platform: opts.ctx.platform,
          aspectRatio: opts.ctx.aspectRatio,
          userNiche: prefs.niche,
          formatPreference: prefs.formatPreference,
          postFrequency: prefs.postFrequency,
          modelPreferences,
        }),
        model,
        mcpServers: { [MCP_SERVER_NAME]: server },
        allowedTools: [...ALLOWED_TOOL_NAMES, "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        maxTurns: MAX_TURNS,
        abortController: opts.abortController,
        env: agentEnv,
      },
    }) as AsyncIterable<SdkMessage>) {
      handle(message, onEvent);
    }
    onEvent({ type: "done", stop_reason: "end_turn" });
  } catch (error) {
    const message = (error as Error).message || "agent error";
    if (message.toLowerCase().includes("abort")) {
      onEvent({ type: "done", stop_reason: "aborted" });
      return;
    }
    // Real agent failure (not a user abort) — report it.
    captureException(error, {
      source: "ai.agent.run",
      userId: opts.ctx.userId,
      projectId: opts.ctx.projectId,
      model,
    });
    onEvent({ type: "error", message });
    throw error;
  }
}

function handle(message: SdkMessage, emit: (event: AgentEvent) => void) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) {
        emit({ type: "text", text: block.text });
      } else if (block.type === "tool_use" && block.name && block.id) {
        const name = stripMcpPrefix(block.name);
        const input = block.input || {};
        emit({ type: "tool_use", name, input, id: block.id });
        // Structured lifecycle event for the live activity indicator. Additive:
        // emitted right after tool_use so legacy consumers are unaffected.
        emit({
          type: "tool_start",
          id: block.id,
          name,
          label: friendlyToolLabel(name, input),
        });
      }
    }
  } else if (message.type === "user" && message.message?.content) {
    for (const block of message.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        let result = "";
        const images: ToolResultImage[] = [];
        if (typeof block.content === "string") {
          result = block.content;
        } else if (Array.isArray(block.content)) {
          const items = block.content as Array<{
            type?: string;
            text?: string;
            data?: string;
            mimeType?: string;
            source?: { data?: string; media_type?: string };
          }>;
          const textParts: string[] = [];
          for (const item of items) {
            if (item.type === "text" && item.text) {
              textParts.push(item.text);
            } else if (item.type === "image") {
              const data = item.data || item.source?.data;
              const mime =
                (item.mimeType as ToolResultImage["mimeType"]) ||
                (item.source?.media_type as ToolResultImage["mimeType"]) ||
                "image/png";
              if (data) images.push({ data, mimeType: mime });
            }
          }
          result = textParts.join("\n");
        } else {
          result = JSON.stringify(block.content);
        }
        emit({
          type: "tool_result",
          tool_use_id: block.tool_use_id,
          result,
          images: images.length ? images : undefined,
        });
        // Structured lifecycle event for the live activity indicator. Additive:
        // emitted right after tool_result so legacy consumers are unaffected.
        emit({
          type: "tool_end",
          id: block.tool_use_id,
          name: stripMcpPrefix(block.name || ""),
          ok: block.is_error !== true,
        });
      }
    }
  } else if (message.type === "result") {
    emit({ type: "turn_end", usage: message.usage });
  }
}

function stripMcpPrefix(name: string): string {
  const prefix = `mcp__${MCP_SERVER_NAME}__`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

// Maps a raw tool name (+ its input) to a short, human-readable present-tense
// label for the live activity indicator, e.g. "Searching b-roll…". Any tool
// without an explicit entry falls back to a humanized version of its name, so
// new tools degrade gracefully instead of showing nothing.
const TOOL_LABELS: Record<string, string> = {
  plan_composition: "Planning the composition",
  plan_edit: "Planning the edit",
  list_files: "Reading project files",
  read_file: "Reading a file",
  write_file: "Writing the composition",
  diff_file: "Editing the composition",
  lint_composition: "Checking the composition",
  screenshot_at_time: "Capturing a preview frame",
  get_brand_kit: "Loading your brand kit",
  find_stock: "Finding stock media",
  search_media: "Searching b-roll",
  list_assets: "Listing assets",
  list_assets_summary: "Listing assets",
  list_registry_blocks: "Browsing the block library",
  read_registry_block: "Loading a building block",
  analyze_image: "Analyzing an image",
  caption_asset: "Captioning an asset",
  generate_captions: "Generating captions",
  generate_image: "Generating an image",
  generate_image_variants: "Generating image variants",
  generate_voiceover: "Recording the voiceover",
  generate_broll: "Generating b-roll",
  generate_music: "Composing music",
  start_render: "Starting the render",
  render_edl: "Rendering",
  build_captions_from_words: "Building captions",
  build_word_highlight_captions: "Building captions",
  snap_to_boundary: "Aligning cuts",
  auto_grade_filter: "Color grading",
  compute_segment_offsets: "Computing cut points",
  probe_clip: "Inspecting the clip",
  trim_clip: "Trimming the clip",
  concat_clips: "Joining clips",
  grade_clip: "Color grading the clip",
  chroma_key: "Keying the green screen",
  speed_clip: "Adjusting clip speed",
  overlay_clip: "Compositing an overlay",
  add_transition: "Adding a transition",
  mix_audio: "Mixing audio",
  extract_audio: "Extracting audio",
  burn_captions: "Burning in captions",
  transcribe_clip: "Transcribing the clip",
  pack_footage: "Packing the footage",
  analyze_clip: "Analyzing the clip",
  review_render: "Reviewing the render",
  detect_filler_words: "Finding filler words",
  apply_noise_reduction: "Cleaning up the audio",
  remove_background_noise: "Isolating the voice",
  analyze_pacing: "Analyzing pacing",
  detect_beats: "Detecting the beat",
  quality_check: "Running a quality check",
  draft_script: "Drafting the script",
  save_insight: "Saving a note",
  load_insights: "Loading your preferences",
  trim_audio: "Trimming audio",
  download_asset: "Downloading media",
  design_thumbnail: "Designing the thumbnail",
  fetch_data_source: "Fetching data",
  reformat_composition: "Reformatting the composition",
  visual_critique: "Critiquing the visuals",
  remove_background: "Removing the background",
  crop_image: "Cropping an image",
  get_style_lock: "Loading the style lock",
  prepare_scene_media: "Preparing scene media",
  generate_persona: "Creating your persona",
  get_persona: "Loading the persona",
  use_persona: "Placing the persona",
  add_persona_pose: "Posing the persona",
  update_persona: "Updating the persona",
  read_manifest: "Reading an asset manifest",
  upsert_manifest: "Updating an asset manifest",
  get_project_edit: "Loading edit history",
  undo_project_edit: "Undoing the last edit",
  WebSearch: "Searching the web",
  WebFetch: "Fetching a web page",
};

function friendlyToolLabel(name: string, input: Record<string, unknown>): string {
  // A few tools read better with a hint of what they're acting on.
  if (name === "write_file" && typeof input.path === "string") {
    return input.path.endsWith("index.html")
      ? "Writing the composition"
      : `Writing ${input.path.split("/").pop()}`;
  }
  if ((name === "search_media" || name === "find_stock") && typeof input.query === "string") {
    return `Searching for "${truncateLabel(input.query, 28)}"`;
  }
  const base = TOOL_LABELS[name];
  if (base) return base;
  // Unknown tool → humanize: strip mcp noise, turn snake_case into words.
  return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function truncateLabel(text: string, n: number): string {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}
