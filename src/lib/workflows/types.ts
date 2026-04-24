import type { Scene, Orientation } from "@/lib/scene-schema";

export type SlotType =
  | "text" // multi-line textarea
  | "topic" // single-line text (often paired with an AI generator)
  | "file-single" // one uploaded file
  | "file-folder" // many files of a kind
  | "image-pack" // named image slots (like "poster", "cast photo")
  | "structured-list" // CSV / JSON list of objects
  | "url" // external URL
  | "selection"; // pick from a library

export interface SlotAiGenerator {
  /** Button label, e.g. "Write from topic". */
  label: string;
  /** The slot id it produces ("script", "images", ...). */
  produces: string;
  /** Other slot ids whose values are needed to generate this one. */
  requires?: string[];
  /** Opaque hint the workflow's code can use to dispatch (e.g. "script-from-topic", "images-from-story"). */
  kind: string;
}

export interface InputSlot {
  id: string;
  label: string;
  description?: string;
  type: SlotType;
  accepts?: string[]; // extensions or MIME fragments
  required?: boolean;
  /** Default value for the slot when a new project is created. */
  defaultValue?: unknown;
  /** Optional AI generator that fills this slot. */
  aiGenerator?: SlotAiGenerator;
  /** For "selection" slots: the options to show. */
  options?: Array<{ value: string; label: string; description?: string }>;
  /** For "image-pack" slots: named image slot labels. */
  namedSlots?: Array<{ id: string; label: string; description?: string }>;
  /** If true, the slot accepts YouTube/podcast URLs via yt-dlp. */
  supportsUrlImport?: "video" | "audio";
}

export type SlotValues = Record<string, unknown>;

export interface WorkflowContext {
  /** Current project orientation. Some workflows force one. */
  orientation: Orientation;
  characters: Array<{ id: string; name: string; src: string }>;
  sfx: Array<{ id: string; name: string; src: string }>;
}

export interface GenerateResult {
  scenes: Scene[];
  /** If the generator also produced a script, return it so the UI can show it. */
  script?: string;
}

export interface StreamHandlers {
  onScene: (scene: Scene) => void;
  onError: (message: string) => void;
  onDone: (count: number) => void;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  tagline: string;
  /** Lucide icon name (we look it up at render time). */
  icon: string;
  /** Accent color used in the picker card and badges. */
  accentColor: string;
  /** If the workflow only makes sense in one orientation, specify it. */
  defaultOrientation: Orientation;
  lockOrientation?: boolean;
  /** Whether this workflow is enabled in the UI today. */
  enabled: boolean;
  slots: InputSlot[];
  /**
   * Build scenes from slot values. Called by the main Generate button.
   * May throw — the caller will surface the error as a toast.
   */
  generate: (values: SlotValues, ctx: WorkflowContext) => Promise<GenerateResult>;
  /**
   * Optional streaming variant. If present, WorkflowInputs will use it so
   * scenes appear one-by-one instead of after a long wait.
   */
  generateStream?: (
    values: SlotValues,
    ctx: WorkflowContext,
    handlers: StreamHandlers,
  ) => Promise<void>;
  /**
   * Called when the user clicks an AI-generator button on a slot.
   * Should return the new value for that slot.
   */
  runAiGenerator?: (
    generator: SlotAiGenerator,
    values: SlotValues,
    ctx: WorkflowContext,
  ) => Promise<unknown>;
  /**
   * Templates for the picker — pre-filled slot values. First entry wins by default.
   */
  templates?: Array<{
    id: string;
    name: string;
    description: string;
    values: SlotValues;
  }>;
  /**
   * Whether this workflow is gated behind a paid unlock.
   */
  paid?: boolean;
  /**
   * Review criteria appended to the review system prompt for this workflow.
   */
  reviewCriteria?: string;
  /**
   * Which scene-editor targets to show for scenes in this workflow. The
   * default editor shows all of them, which is too busy for e.g. slideshow.
   */
  sceneEditorTargets?: Array<
    "character" | "text" | "effects" | "background" | "counter" | "broll"
  >;
  /**
   * Extra scene-level actions surfaced at the top of the scene editor. Lets a
   * workflow declare its own "re-prompt this image" / "auto-trim clip" etc.
   */
  sceneActions?: Array<{
    id: string;
    label: string;
    kind: string;
  }>;
  /**
   * Auto-video pipeline — chain the entire flow from topic to render. Each
   * workflow declares what its pipeline does. If absent, the button is hidden.
   */
  autoPipeline?: {
    topicLabel: string;
    topicSlotId: string;
    steps: Array<{
      label: string;
      /**
       * Returns undefined when the step is a no-op. Throws on error.
       * The step mutates slot values via setValues.
       */
      run: (
        values: SlotValues,
        setValues: (patch: SlotValues) => void,
        ctx: WorkflowContext,
      ) => Promise<void>;
    }>;
  };
}
