export const AI_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    message: {
      type: "string" as const,
      description: "Human-readable response to show in the chat",
    },
    actions: {
      type: "array" as const,
      description:
        "List of editor actions to execute. Empty array if no actions needed.",
      items: {
        type: "object" as const,
        properties: {
          tool: {
            type: "string" as const,
            enum: [
              // Read-only
              "get_timeline_state",
              "get_media_assets",
              // Insert
              "insert_text",
              "insert_video",
              "insert_image",
              "insert_generated_image",
              "insert_audio",
              // Modify
              "update_element",
              "delete_elements",
              "move_element",
              "split_element",
              // Keyframes
              "upsert_keyframe",
              "remove_keyframe",
              // Effects
              "add_effect",
              "update_effect_params",
              // Playback
              "set_playhead",
              // Remotion
              "create_remotion_effect",
              // Media generation
              "generate_media",
              // LUT
              "apply_lut",
              // Subtitles
              "import_subtitles",
              "auto_caption",
              // Templates
              "use_template",
              // Undo/Redo
              "undo",
              "redo",
              // Batch
              "batch_update",
              // Project
              "save_project",
              "export_preset",
              // Plan mode
              "create_plan",
              // Clip operations
              "trim_clip",
              "add_transition",
              "speed_ramp",
              "freeze_frame",
              // Audio operations
              "add_voiceover",
              "ducking",
              "silence_detection",
              // Text & graphics
              "add_animated_title",
              "add_caption_track",
              "add_callout",
              // Color & effects
              "add_filter",
              "picture_in_picture",
              "ken_burns",
              // Smart operations
              "auto_jump_cut",
              "smart_reframe",
            ],
          },
          params: {
            type: "object" as const,
            description: "Parameters for the action",
          },
        },
        required: ["tool", "params"],
      },
    },
  },
  required: ["message", "actions"],
};
