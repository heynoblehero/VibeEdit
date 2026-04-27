"use client";

/**
 * AIPanel — agent commands as draggable cards. Drop targets:
 *
 *  - Drop on a Timeline scene block (or SceneCard) → focuses that
 *    scene + opens chat + submits the prefab prompt.
 *  - Click "Open chat" at the top → opens the chat sidebar without
 *    pre-filling. Same as the keyboard Cmd+K.
 *
 * The drop handler in SceneCard.tsx / Timeline.tsx reads the
 * vibeedit/ai-action MIME type and acts on it. Keeps focus + chat
 * plumbing in one place (this component is purely UI).
 */

import { MessageCircle, Sparkles, Wand2 } from "lucide-react";

interface AICard {
  id: string;
  label: string;
  prompt: string;
  description: string;
}

const PROJECT_LEVEL: AICard[] = [
  {
    id: "auto_build",
    label: "Auto-build a video",
    prompt: "/cinematic-short Make a short video about something interesting. Pick the topic.",
    description: "Run the full autonomous loop end-to-end.",
  },
  {
    id: "review",
    label: "Review my video",
    prompt: "Run selfCritique on the project. List the top 5 issues holding it back, prioritized.",
    description: "Critic pass across all scenes.",
  },
  {
    id: "score",
    label: "Score quality",
    prompt: "Run videoQualityScore. Tell me what's weak and how to fix it.",
    description: "0-100 score + breakdown.",
  },
  {
    id: "publish_meta",
    label: "Generate publish metadata",
    prompt: "Run generatePublishMetadata for TikTok. Give me 3 titles, a caption, and hashtags.",
    description: "Titles · caption · hashtags.",
  },
  {
    id: "match_cuts",
    label: "Find match cuts",
    prompt: "Run suggestMatchCuts. Apply any positive matches as match_cut transitions.",
    description: "Vision-suggested timing.",
  },
  {
    id: "subtitles",
    label: "Export subtitles (SRT)",
    prompt: "Run exportSubtitles in srt format with 5 words per cue.",
    description: "All scenes' word-timing → SRT.",
  },
];

// Drop these on a scene to scope to it + run the prefab.
const PER_SCENE: AICard[] = [
  {
    id: "improve",
    label: "Improve this scene",
    prompt: "Improve this scene — pick the weakest aspect and fix it. Don't touch other scenes.",
    description: "Drop on a scene → focused fix.",
  },
  {
    id: "renarrate",
    label: "Re-narrate",
    prompt: "Re-narrate this scene with a different voice or tone — keep the script.",
    description: "Drop on a scene → fresh voiceover.",
  },
  {
    id: "regen_image",
    label: "New background image",
    prompt: "Replace this scene's background image with a fresh AI-generated one matching the script.",
    description: "Drop on a scene → regenerate bg.",
  },
  {
    id: "match_next",
    label: "Match style to next",
    prompt: "Make this scene's color grade, motion, and font match the next scene.",
    description: "Drop on a scene → harmonize.",
  },
  {
    id: "self_critique_scene",
    label: "Critique this scene",
    prompt: "Run selfCritique on this scene only and apply the top fix.",
    description: "Drop on a scene → focused critique.",
  },
];

function openChat(prompt?: string) {
  const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
  window.dispatchEvent(evt);
  if (prompt) {
    setTimeout(async () => {
      const { useChatStore } = await import("@/store/chat-store");
      useChatStore.getState().addUserMessage(prompt);
      document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
    }, 80);
  }
}

export function AIPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
        <h2 className="text-xs font-semibold text-white">AI</h2>
        <button
          type="button"
          onClick={() => openChat()}
          className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-300"
          title="Open chat (Cmd+K)"
        >
          <MessageCircle className="h-3 w-3" />
          chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <Section title="Project-wide" cards={PROJECT_LEVEL} mode="run" />
        <Section title="Drop on a scene" cards={PER_SCENE} mode="drag" />
      </div>
    </div>
  );
}

function Section({
  title,
  cards,
  mode,
}: {
  title: string;
  cards: AICard[];
  mode: "run" | "drag";
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40">
      <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
        <Wand2 className="h-3 w-3" />
        <span>{title}</span>
        <span className="ml-auto text-neutral-600">{mode === "drag" ? "drag" : "click"}</span>
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        {cards.map((card) => (
          <div
            key={card.id}
            draggable={mode === "drag"}
            onDragStart={
              mode === "drag"
                ? (e) => {
                    e.dataTransfer.setData(
                      "vibeedit/ai-action",
                      JSON.stringify({ id: card.id, prompt: card.prompt }),
                    );
                    e.dataTransfer.setData("text/plain", card.label);
                    e.dataTransfer.effectAllowed = "copy";
                  }
                : undefined
            }
            onClick={mode === "run" ? () => openChat(card.prompt) : undefined}
            title={`${card.label}\n${card.description}`}
            className={
              mode === "drag"
                ? "group cursor-grab active:cursor-grabbing rounded bg-neutral-900 border border-neutral-800 hover:border-sky-500/60 hover:bg-sky-500/5 px-2 py-1.5 transition-colors select-none"
                : "group cursor-pointer rounded bg-neutral-900 border border-neutral-800 hover:border-sky-500/60 hover:bg-sky-500/5 px-2 py-1.5 transition-colors select-none"
            }
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-sky-400 shrink-0" />
              <span className="text-[11px] font-medium text-neutral-200 group-hover:text-white truncate">
                {card.label}
              </span>
            </div>
            <div className="text-[9px] text-neutral-500 group-hover:text-sky-300/80 mt-0.5 line-clamp-1">
              {card.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
