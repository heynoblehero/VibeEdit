import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface VoiceClone {
  id: string;
  name: string;
  createdAt: number;
}

interface VoiceStore {
  clones: VoiceClone[];
  activeVoice: { kind: "openai"; id: string } | { kind: "elevenlabs"; id: string };
  refresh: () => Promise<void>;
  setActive: (v: VoiceStore["activeVoice"]) => void;
  removeClone: (id: string) => Promise<void>;
}

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set, get) => ({
      clones: [],
      activeVoice: { kind: "openai", id: "nova" },

      async refresh() {
        try {
          const res = await fetch("/api/voice-clones");
          if (!res.ok) return;
          const data = (await res.json()) as { voices: VoiceClone[] };
          set({ clones: data.voices ?? [] });
          // If the currently-active voice was deleted out of band, fall back.
          const active = get().activeVoice;
          if (
            active.kind === "elevenlabs" &&
            !(data.voices ?? []).some((v) => v.id === active.id)
          ) {
            set({ activeVoice: { kind: "openai", id: "nova" } });
          }
        } catch {
          // ignore
        }
      },

      setActive(v) {
        set({ activeVoice: v });
      },

      async removeClone(id) {
        try {
          await fetch(`/api/voice-clones?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          const next = get().clones.filter((c) => c.id !== id);
          set({ clones: next });
          const active = get().activeVoice;
          if (active.kind === "elevenlabs" && active.id === id) {
            set({ activeVoice: { kind: "openai", id: "nova" } });
          }
        } catch {
          // ignore
        }
      },
    }),
    {
      name: "vibeedit-voice",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ activeVoice: s.activeVoice }),
    },
  ),
);
