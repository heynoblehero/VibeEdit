"use client";

/**
 * ActionsPanel — draggable cards for transitions, effects, and scene
 * types. Drop targets:
 *
 *  - Transition card → drop on a CutMarker → upserts a Cut with that
 *    kind + a sensible default duration.
 *  - Effect card → drop on a Timeline scene block → pushes onto
 *    scene.effects with default startFrame=0.
 *  - Scene-type card → drop on the Timeline at a frame position →
 *    insertSceneAt with that scene type pre-set.
 *
 * Each card sets a JSON payload on dataTransfer under a vibeedit/*
 * MIME type. The drop handlers in Timeline.tsx and CutMarker.tsx
 * decode and apply.
 */

import {
  BarChart3,
  Heading,
  Layers,
  Palette,
  Quote,
  Scissors,
  Sparkles,
  Square,
  Type,
  Wand2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";

type CardKind = "transition" | "effect" | "scene_type" | "look" | "title";

interface ActionCard {
  id: string;
  kind: CardKind;
  /** Schema-level value (CutKind / SceneEffectKind / Scene["type"]). */
  value: string;
  label: string;
  description: string;
  /** Optional default params bundled with the drag payload. */
  params?: Record<string, unknown>;
}

const TRANSITIONS: ActionCard[] = [
  { id: "fade", kind: "transition", value: "fade", label: "Fade", description: "Soft cross-dissolve", params: { durationFrames: 12 } },
  { id: "dip_to_black", kind: "transition", value: "dip_to_black", label: "Dip to black", description: "Time jump", params: { durationFrames: 24, color: "#000000" } },
  { id: "dip_to_white", kind: "transition", value: "dip_to_white", label: "Dip to white", description: "Bright reveal", params: { durationFrames: 18, color: "#ffffff" } },
  { id: "iris", kind: "transition", value: "iris", label: "Iris", description: "Circle wipe", params: { durationFrames: 16 } },
  { id: "clock_wipe", kind: "transition", value: "clock_wipe", label: "Clock wipe", description: "Sweep around center", params: { durationFrames: 20 } },
  { id: "flip", kind: "transition", value: "flip", label: "Flip", description: "Card flip", params: { durationFrames: 14 } },
  { id: "slide_left", kind: "transition", value: "slide_left", label: "Slide left", description: "Push from right", params: { durationFrames: 12 } },
  { id: "whip_pan", kind: "transition", value: "whip_pan", label: "Whip pan", description: "Motion-blurred slide", params: { durationFrames: 10 } },
  { id: "smash_cut", kind: "transition", value: "smash_cut", label: "Smash cut", description: "Bright flash + audio kick", params: { durationFrames: 6, color: "#ffffff" } },
  { id: "glitch_cut", kind: "transition", value: "glitch_cut", label: "Glitch", description: "RGB-split shake", params: { durationFrames: 12 } },
  { id: "zoom_blur", kind: "transition", value: "zoom_blur", label: "Zoom blur", description: "Scale + blur push", params: { durationFrames: 12 } },
  { id: "jump_cut", kind: "transition", value: "jump_cut", label: "Jump cut", description: "Vlog-style continuity", params: { durationFrames: 4 } },
];

const EFFECTS: ActionCard[] = [
  { id: "lens_flare", kind: "effect", value: "circle_ping", label: "Circle ping", description: "Impact ring", params: { color: "#10b981" } },
  { id: "radial_pulse", kind: "effect", value: "radial_pulse", label: "Radial pulse", description: "Center flash" },
  { id: "scan_line", kind: "effect", value: "scan_line", label: "Scan line", description: "Vertical sweep" },
  { id: "bar_wipe", kind: "effect", value: "bar_wipe", label: "Bar wipe", description: "Section divider with label" },
  { id: "corner_brackets", kind: "effect", value: "corner_brackets", label: "Corner brackets", description: "4-corner viewfinder" },
  { id: "reveal_box", kind: "effect", value: "reveal_box", label: "Reveal box", description: "Border draws around region" },
  { id: "lower_third", kind: "effect", value: "lower_third", label: "Lower third", description: "Slide-in name strap" },
  { id: "typewriter", kind: "effect", value: "typewriter", label: "Typewriter", description: "Char-by-char reveal" },
  { id: "glitch", kind: "effect", value: "glitch", label: "Glitch text", description: "RGB-split garble" },
  { id: "particles", kind: "effect", value: "particles", label: "Particles", description: "Confetti burst" },
  { id: "progress_bar", kind: "effect", value: "progress_bar", label: "Progress bar", description: "Fills toward target %" },
];

/**
 * "Looks" — preset bundles of scene.background overrides. Each card
 * carries the exact field values to merge onto scene.background when
 * dropped. No new schema — these are just sugar over the colorGrade
 * preset + the brightness/contrast/saturation/temperature/blur sliders
 * we already ship.
 */
const LOOKS: ActionCard[] = [
  {
    id: "look_cinematic",
    kind: "look",
    value: "cinematic",
    label: "Cinematic",
    description: "Warm grade · slight contrast lift",
    params: { colorGrade: "warm", contrast: 1.12, saturation: 1.08, brightness: 0.98 },
  },
  {
    id: "look_punchy",
    kind: "look",
    value: "punchy",
    label: "Punchy",
    description: "High contrast · saturated",
    params: { colorGrade: "punchy", contrast: 1.25, saturation: 1.2 },
  },
  {
    id: "look_noir",
    kind: "look",
    value: "noir",
    label: "Noir B&W",
    description: "Monochrome · deep shadows",
    params: { colorGrade: "bw", contrast: 1.3, brightness: 0.92 },
  },
  {
    id: "look_dreamy",
    kind: "look",
    value: "dreamy",
    label: "Dreamy",
    description: "Soft blur · low contrast · pastel",
    params: { blur: 4, contrast: 0.88, saturation: 0.85, brightness: 1.06 },
  },
  {
    id: "look_vintage",
    kind: "look",
    value: "vintage",
    label: "Vintage",
    description: "Sepia tone · faded contrast",
    params: { colorGrade: "warm", saturation: 0.7, contrast: 0.9, temperature: 0.4 },
  },
  {
    id: "look_neon",
    kind: "look",
    value: "neon",
    label: "Neon",
    description: "Punched saturation · cool tone",
    params: { saturation: 1.5, contrast: 1.15, temperature: -0.5, brightness: 0.95 },
  },
  {
    id: "look_polaroid",
    kind: "look",
    value: "polaroid",
    label: "Polaroid",
    description: "Faded · slightly washed · warm",
    params: { contrast: 0.92, saturation: 0.85, temperature: 0.25, brightness: 1.04 },
  },
  {
    id: "look_sunset",
    kind: "look",
    value: "sunset",
    label: "Sunset",
    description: "Golden · soft contrast",
    params: { colorGrade: "warm", saturation: 1.18, temperature: 0.55, brightness: 1.02 },
  },
  {
    id: "look_cyber",
    kind: "look",
    value: "cyber",
    label: "Cyberpunk",
    description: "Magenta highlights · cool shadows",
    params: { saturation: 1.45, contrast: 1.2, temperature: -0.35, brightness: 0.95 },
  },
  {
    id: "look_anime",
    kind: "look",
    value: "anime",
    label: "Anime",
    description: "High saturation · clean contrast",
    params: { saturation: 1.4, contrast: 1.18, brightness: 1.04 },
  },
  {
    id: "look_document",
    kind: "look",
    value: "document",
    label: "Documentary",
    description: "Neutral · slight desaturation",
    params: { colorGrade: "neutral", saturation: 0.92, contrast: 1.04 },
  },
  {
    id: "look_moonlight",
    kind: "look",
    value: "moonlight",
    label: "Moonlight",
    description: "Cool · low key · slight blur",
    params: { colorGrade: "cool", brightness: 0.88, contrast: 1.1, blur: 1, temperature: -0.3 },
  },
];

/**
 * Title templates — drop on the timeline to insert a new scene with
 * the title's text + styling baked in. Each carries a bundle of scene
 * fields (text, sizes, colors, motion, transition, effects). The
 * Timeline's vibeedit/title drop handler creates a blank scene and
 * merges these fields onto it.
 */
const TITLES: ActionCard[] = [
  {
    id: "title_bold",
    kind: "title",
    value: "bold_opener",
    label: "Bold opener",
    description: "Massive ALL-CAPS punch",
    params: {
      type: "text_only",
      duration: 3,
      emphasisText: "BIG IDEA",
      emphasisSize: 160,
      emphasisColor: "#ffffff",
      textY: 700,
      zoomPunch: 1.18,
      transition: "beat_flash",
      background: { color: "#0a0a0a", colorGrade: "punchy" },
      emphasisMotion: "bounce_in",
    },
  },
  {
    id: "title_minimalist",
    kind: "title",
    value: "minimalist",
    label: "Minimalist",
    description: "Thin serif, slow drift",
    params: {
      type: "text_only",
      duration: 3.5,
      text: "edit me",
      textSize: 72,
      textColor: "#e5e5e5",
      textY: 800,
      transition: "fade",
      background: { color: "#0a0a0a" },
      textMotion: "drift_up",
    },
  },
  {
    id: "title_kinetic",
    kind: "title",
    value: "kinetic",
    label: "Kinetic typography",
    description: "Word-by-word slam",
    params: {
      type: "text_only",
      duration: 2.5,
      text: "every word",
      emphasisText: "SLAMS",
      emphasisSize: 140,
      emphasisColor: "#10b981",
      textY: 600,
      zoomPunch: 1.2,
      transition: "smash_cut",
      background: { color: "#0a0a0a" },
      emphasisMotion: "shake",
    },
  },
  {
    id: "title_lower_third",
    kind: "title",
    value: "lower_third",
    label: "Lower-third name",
    description: "Speaker intro strap",
    params: {
      type: "text_only",
      duration: 3,
      effects: [
        {
          kind: "lower_third",
          startFrame: 6,
          text: "Sam Altman",
          subtext: "OpenAI · CEO",
          color: "#10b981",
        },
      ],
      transition: "none",
      background: { color: "#0a0a0a" },
    },
  },
  {
    id: "title_quote",
    kind: "title",
    value: "quote",
    label: "Quote card",
    description: "Pull-quote with attribution",
    params: {
      type: "quote",
      duration: 4,
      quoteText: "Edit this pull quote.",
      quoteAttribution: "Author",
      transition: "fade",
      background: { color: "#0a0a0a", vignette: 0.5 },
    },
  },
  {
    id: "title_chapter",
    kind: "title",
    value: "chapter",
    label: "Chapter card",
    description: "Bar wipe + chapter label",
    params: {
      type: "text_only",
      duration: 2.5,
      effects: [
        {
          kind: "bar_wipe",
          startFrame: 0,
          color: "#10b981",
          text: "PART 02",
          y: "50%",
          size: 110,
        },
      ],
      transition: "slide_left",
      background: { color: "#0a0a0a" },
    },
  },
];

const SCENE_TYPES: ActionCard[] = [
  { id: "text_only", kind: "scene_type", value: "text_only", label: "Text", description: "Punch line over color" },
  { id: "stat", kind: "scene_type", value: "stat", label: "Stat", description: "Hero number + label" },
  { id: "big_number", kind: "scene_type", value: "big_number", label: "Counter", description: "Animated number 0→N" },
  { id: "bullet_list", kind: "scene_type", value: "bullet_list", label: "Bullet list", description: "Staggered checkmarks" },
  { id: "quote", kind: "scene_type", value: "quote", label: "Quote", description: "Pull-quote + attribution" },
  { id: "split", kind: "scene_type", value: "split", label: "Split", description: "Side-by-side compare" },
  { id: "montage", kind: "scene_type", value: "montage", label: "Montage", description: "3-5 quick cuts" },
  { id: "bar_chart", kind: "scene_type", value: "bar_chart", label: "Bar chart", description: "Animated columns" },
];

const SECTIONS: Array<{ key: string; title: string; icon: typeof Wand2; cards: ActionCard[] }> = [
  { key: "titles", title: "Titles", icon: Heading, cards: TITLES },
  { key: "transitions", title: "Transitions", icon: Scissors, cards: TRANSITIONS },
  { key: "looks", title: "Looks", icon: Palette, cards: LOOKS },
  { key: "effects", title: "Effects", icon: Zap, cards: EFFECTS },
  { key: "scenes", title: "Scene types", icon: Layers, cards: SCENE_TYPES },
];

const ICON_FOR_VALUE: Record<string, typeof Wand2> = {
  text_only: Type,
  stat: BarChart3,
  big_number: BarChart3,
  bullet_list: Layers,
  quote: Quote,
  split: Square,
  montage: Sparkles,
  bar_chart: BarChart3,
};

export function ActionsPanel() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const recent = useEditorStore((s) => s.recentActions);

  // Resolve each MRU entry back to its full ActionCard so we can re-emit
  // the exact same payload the section card would.
  const recentCards: Array<{ section: typeof SECTIONS[number]; card: ActionCard }> = [];
  for (const r of recent) {
    for (const s of SECTIONS) {
      if (s.key === "scenes") continue;
      const c = s.cards.find((c) => c.value === r.value);
      if (c) {
        recentCards.push({ section: s, card: c });
        break;
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        <Wand2 className="h-3.5 w-3.5 text-amber-400" />
        <h2 className="text-xs font-semibold text-white">Actions</h2>
        <span className="text-[10px] text-neutral-500 ml-auto">drag onto timeline</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {recentCards.length > 0 && (
          <div className="rounded border border-amber-700/40 bg-amber-500/5">
            <div className="px-2 py-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-300/80">
              <Wand2 className="h-3 w-3" />
              <span>Recent</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1.5">
              {recentCards.slice(0, 6).map(({ section, card }) => {
                const dragMime =
                  section.key === "transitions"
                    ? "vibeedit/transition"
                    : section.key === "effects"
                      ? "vibeedit/effect"
                      : section.key === "looks"
                        ? "vibeedit/look"
                        : section.key === "titles"
                          ? "vibeedit/title"
                          : "vibeedit/scene-type";
                return (
                  <div
                    key={`${section.key}-${card.value}`}
                    draggable
                    onDragStart={(e) => {
                      const payload = JSON.stringify({
                        value: card.value,
                        params: card.params,
                      });
                      e.dataTransfer.setData(dragMime, payload);
                      e.dataTransfer.setData("text/plain", card.label);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title={`${card.label} · ${section.title}`}
                    className="group cursor-grab active:cursor-grabbing rounded border border-amber-700/30 hover:border-amber-400 bg-neutral-900 px-2 py-1.5 text-[10px] text-neutral-300 hover:text-amber-200 transition-colors"
                  >
                    {card.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isCollapsed = collapsed[section.key];
          return (
            <div key={section.key} className="rounded border border-neutral-800 bg-neutral-900/40">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [section.key]: !isCollapsed }))
                }
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-neutral-400 hover:text-white"
              >
                <SectionIcon className="h-3 w-3" />
                <span>{section.title}</span>
                <span className="ml-auto text-neutral-600">{isCollapsed ? "▸" : "▾"}</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-1.5 p-1.5">
                  {section.cards.map((card) => {
                    const CardIcon =
                      card.kind === "scene_type" ? ICON_FOR_VALUE[card.value] ?? Wand2 : Wand2;
                    const dragMime =
                      card.kind === "transition"
                        ? "vibeedit/transition"
                        : card.kind === "effect"
                          ? "vibeedit/effect"
                          : card.kind === "look"
                            ? "vibeedit/look"
                            : card.kind === "title"
                              ? "vibeedit/title"
                              : "vibeedit/scene-type";
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          const payload = JSON.stringify({
                            kind: card.kind,
                            value: card.value,
                            params: card.params ?? {},
                          });
                          e.dataTransfer.setData(dragMime, payload);
                          e.dataTransfer.setData("text/plain", card.label);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        title={`${card.label}\n${card.description}\n\nDrag onto:\n${
                          card.kind === "transition"
                            ? "· a cut diamond between scenes"
                            : card.kind === "effect"
                              ? "· any scene block (overlay)"
                              : card.kind === "look"
                                ? "· any scene block (color/look)"
                                : "· timeline gap or empty area"
                        }`}
                        className="group cursor-grab active:cursor-grabbing rounded bg-neutral-900 border border-neutral-800 hover:border-amber-500/60 hover:bg-amber-500/5 px-2 py-1.5 transition-colors select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          {card.kind === "scene_type" && (
                            <CardIcon className="h-3 w-3 text-neutral-400 group-hover:text-amber-300 shrink-0" />
                          )}
                          <span className="text-[11px] font-medium text-neutral-200 group-hover:text-white truncate">
                            {card.label}
                          </span>
                        </div>
                        <div className="text-[9px] text-neutral-500 group-hover:text-amber-300/80 mt-0.5 line-clamp-1">
                          {card.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
