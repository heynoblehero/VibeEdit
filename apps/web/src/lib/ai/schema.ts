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
              "get_timeline_state",
              "get_media_assets",
              "insert_text",
              "insert_video",
              "insert_image",
              "insert_audio",
              "update_element",
              "delete_elements",
              "move_element",
              "split_element",
              "upsert_keyframe",
              "remove_keyframe",
              "add_effect",
              "update_effect_params",
              "set_playhead",
              "create_remotion_effect",
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
