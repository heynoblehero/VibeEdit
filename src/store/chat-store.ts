import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Project } from "@/lib/scene-schema";
import { throttledLocalStorage } from "./throttled-storage";

export interface ToolCallEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  ok?: boolean;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallEvent[];
  /** Snapshot of project state BEFORE this turn's effects. Lets us undo-turn. */
  projectBefore?: Project;
  createdAt: number;
  streaming?: boolean;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  addUserMessage: (content: string) => string;
  startAssistantMessage: (projectBefore: Project) => string;
  appendText: (messageId: string, text: string) => void;
  addToolCall: (messageId: string, call: ToolCallEvent) => void;
  updateToolCall: (messageId: string, toolId: string, patch: Partial<ToolCallEvent>) => void;
  finishAssistantMessage: (messageId: string) => void;
  setStreaming: (v: boolean) => void;
  clear: () => void;
  removeMessage: (id: string) => void;
  undoTurn: (messageId: string) => Project | null;
}

function cid(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
  messages: [],
  isStreaming: false,

  addUserMessage(content) {
    const msg: ChatMessage = {
      id: cid(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg.id;
  },

  startAssistantMessage(projectBefore) {
    const msg: ChatMessage = {
      id: cid(),
      role: "assistant",
      content: "",
      toolCalls: [],
      projectBefore,
      createdAt: Date.now(),
      streaming: true,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg.id;
  },

  appendText(messageId, text) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + text } : m,
      ),
    }));
  },

  addToolCall(messageId, call) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] }
          : m,
      ),
    }));
  },

  updateToolCall(messageId, toolId, patch) {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          toolCalls: (m.toolCalls ?? []).map((c) =>
            c.id === toolId ? { ...c, ...patch } : c,
          ),
        };
      }),
    }));
  },

  finishAssistantMessage(messageId) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, streaming: false } : m,
      ),
    }));
  },

  setStreaming(v) {
    set({ isStreaming: v });
  },

  clear() {
    set({ messages: [] });
  },

  removeMessage(id) {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
  },

  undoTurn(messageId) {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg || !msg.projectBefore) return null;
    // Drop this assistant message + everything after it.
    set((s) => ({
      messages: s.messages.slice(0, s.messages.findIndex((m) => m.id === messageId)),
    }));
    return msg.projectBefore;
  },
    }),
    {
      name: "vibeedit-chat",
      storage: createJSONStorage(() => throttledLocalStorage()),
      // Don't persist the streaming flag — messages only.
      partialize: (s) => ({ messages: s.messages }),
    },
  ),
);
