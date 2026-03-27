import { create } from "zustand";
import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { buildEditorContext } from "@/lib/ai/system-prompt";
import { executeAIActions } from "@/lib/ai/executor";
import { processMediaAssets } from "@/lib/media/processing";
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

  const addMediaFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const activeProject = editor.project.getActive();
    if (!activeProject) return;

    const projectId = activeProject.metadata.id;

    try {
      const processedAssets = await processMediaAssets({ files });

      for (const asset of processedAssets) {
        await editor.media.addMediaAsset({ projectId, asset });
      }

      // Build summary lines for the system message
      const lines = processedAssets.map((asset) => {
        if (asset.type === "video") {
          const dur = asset.duration != null ? `${asset.duration.toFixed(1)}s` : "unknown duration";
          return `\u2022 ${asset.name} (video, ${dur})`;
        }
        if (asset.type === "image") {
          const dims = asset.width && asset.height ? `${asset.width}x${asset.height}` : "unknown size";
          return `\u2022 ${asset.name} (image, ${dims})`;
        }
        if (asset.type === "audio") {
          const dur = asset.duration != null ? `${asset.duration.toFixed(1)}s` : "unknown duration";
          return `\u2022 ${asset.name} (audio, ${dur})`;
        }
        return `\u2022 ${asset.name}`;
      });

      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `\u{1F4CE} Added to media library:\n${lines.join("\n")}`,
        timestamp: Date.now(),
      };

      useAIChatStore.setState((s) => ({
        messages: [...s.messages, systemMsg],
      }));
    } catch (err) {
      console.error("Error adding media files:", err);
    }
  }, [editor]);

  const clearChat = useCallback(() => {
    useAIChatStore.setState({
      messages: [],
      sessionId: null,
      error: null,
    });
  }, []);

  return { messages, sessionId, isLoading, error, sendMessage, clearChat, addMediaFiles };
}
