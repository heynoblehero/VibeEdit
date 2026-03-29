export const CREDIT_COSTS: Record<string, number> = {
  // AI Chat
  ai_message: 1,

  // Media generation
  generate_media_elevenlabs: 5,
  generate_media_stability: 3,

  // Remotion
  create_remotion_effect: 2,
  use_template: 1,

  // Auto-caption
  auto_caption: 5,

  // Storyboard generation
  storyboard_generate: 10,

  // Auto-clip analysis
  clip_analysis: 10,

  // Render (per minute of output video)
  render_per_minute: 10,

  // Free operations (0 cost)
  insert_text: 0,
  insert_video: 0,
  insert_image: 0,
  insert_generated_image: 0,
  insert_audio: 0,
  update_element: 0,
  delete_elements: 0,
  move_element: 0,
  split_element: 0,
  upsert_keyframe: 0,
  remove_keyframe: 0,
  add_effect: 0,
  update_effect_params: 0,
  apply_lut: 0,
  set_playhead: 0,
  get_timeline_state: 0,
  get_media_assets: 0,
  undo: 0,
  redo: 0,
  batch_update: 0,
  save_project: 0,
  export_preset: 0,
  import_subtitles: 0,
};

export function getCreditCost(toolName: string): number {
  return CREDIT_COSTS[toolName] ?? 0;
}

export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 100, price: 500, priceDisplay: "$5" },
  { id: "pro", name: "Pro", credits: 500, price: 2000, priceDisplay: "$20", popular: true },
  { id: "studio", name: "Studio", credits: 1500, price: 5000, priceDisplay: "$50" },
] as const;

export const SIGNUP_BONUS_CREDITS = 10;
