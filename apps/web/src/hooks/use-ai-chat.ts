import { create } from "zustand";
import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { buildEditorContext } from "@/lib/ai/system-prompt";
import { executeAIActions } from "@/lib/ai/executor";
import type { AIAction, AIActionResult, ChatMessage } from "@/lib/ai/types";

interface AIChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

const useAIChatStore = create<AIChatState>(() => ({
  messages: [],
  sessionId: null,
  isLoading: false,
  error: null,
}));

export function useAIChat() {
  const editor = useEditor();
  const { messages, sessionId, isLoading, error } = useAIChatStore();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    useAIChatStore.setState((s) => ({
      messages: [...s.messages, userMsg],
      isLoading: true,
      error: null,
    }));

    try {
      const editorContext = buildEditorContext(editor);

      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: useAIChatStore.getState().sessionId,
          editorContext,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      // Execute actions client-side
      let actionResults: AIActionResult[] = [];
      if (data.actions && data.actions.length > 0) {
        actionResults = executeAIActions(data.actions);
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text || "Done.",
        actions: data.actions,
        actionResults,
        timestamp: Date.now(),
      };

      useAIChatStore.setState((s) => ({
        messages: [...s.messages, assistantMsg],
        sessionId: data.sessionId || s.sessionId,
        isLoading: false,
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      useAIChatStore.setState({
        isLoading: false,
        error: errorMsg,
      });
    }
  }, [editor]);

  const clearChat = useCallback(() => {
    useAIChatStore.setState({
      messages: [],
      sessionId: null,
      error: null,
    });
  }, []);

  return { messages, sessionId, isLoading, error, sendMessage, clearChat };
}
