import type { AIAction } from "@/lib/ai/types";

export interface StoryboardScene {
  id: string;
  order: number;
  title: string;
  description: string;
  duration: number;
  visualType: "text" | "image" | "video" | "generated" | "effect";
  aiActions: AIAction[];
  approved: boolean;
  executed: boolean;
  suggestedText?: string;
  suggestedColor?: string;
  suggestedEffect?: string;
  notes?: string;
}

export interface Storyboard {
  id: string;
  concept: string;
  targetDuration: number;
  style: string;
  scenes: StoryboardScene[];
  createdAt: number;
}

export type StoryboardState =
  | "idle"
  | "generating"
  | "reviewing"
  | "executing"
  | "done"
  | "error";
