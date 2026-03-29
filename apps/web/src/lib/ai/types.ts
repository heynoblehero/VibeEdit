export type AIActionTool =
  | "get_timeline_state"
  | "get_media_assets"
  | "insert_text"
  | "insert_video"
  | "insert_image"
  | "insert_generated_image"
  | "insert_audio"
  | "update_element"
  | "delete_elements"
  | "move_element"
  | "split_element"
  | "upsert_keyframe"
  | "remove_keyframe"
  | "add_effect"
  | "update_effect_params"
  | "set_playhead"
  | "create_remotion_effect"
  | "generate_media"
  | "apply_lut"
  | "import_subtitles"
  | "auto_caption"
  | "use_template"
  | "undo"
  | "redo"
  | "batch_update"
  | "save_project"
  | "export_preset";

export interface AIAction {
  tool: AIActionTool;
  params: Record<string, unknown>;
}

export interface AIActionResult {
  tool: AIActionTool;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AIResponse {
  text: string;
  actions: AIAction[];
  sessionId: string;
}

export interface AIRequest {
  message: string;
  sessionId?: string;
  editorContext: EditorContext;
}

export interface EditorContext {
  tracks: SerializedTrack[];
  currentTime: number;
  totalDuration: number;
  mediaAssets: SerializedMediaAsset[];
  projectSettings: {
    fps: number;
    canvasSize: { width: number; height: number };
  };
}

export interface SerializedTrack {
  id: string;
  type: string;
  elements: SerializedElement[];
  muted?: boolean;
  hidden?: boolean;
}

export interface SerializedElement {
  id: string;
  type: string;
  name: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  mediaId?: string;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  transform?: {
    scale: number;
    position: { x: number; y: number };
    rotate: number;
  };
  opacity?: number;
  volume?: number;
  muted?: boolean;
  hidden?: boolean;
}

export interface SerializedMediaAsset {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  duration?: number;
  width?: number;
  height?: number;
}

export interface ChatMessageAttachment {
  name: string;
  type: string;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: AIAction[];
  actionResults?: AIActionResult[];
  attachments?: ChatMessageAttachment[];
  timestamp: number;
  snapshotId?: string;
}
