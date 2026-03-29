import { create } from "zustand";
import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "@/hooks/use-editor";
import { buildEditorContext } from "@/lib/ai/system-prompt";
import { executeAIActions } from "@/lib/ai/executor";
import { processMediaAssets } from "@/lib/media/processing";
import { storageService } from "@/services/storage/service";
import { restoreProjectFromSnapshot } from "@/lib/ai/snapshot-restore";
import type { AIAction, AIActionResult, ChatMessage } from "@/lib/ai/types";

interface AIChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  projectId: string | null;
  editingMessageId: string | null;
  editingContent: string | null;
}

const useAIChatStore = create<AIChatState>(() => ({
  messages: [],
  sessionId: null,
  isLoading: false,
  error: null,
  projectId: null,
  editingMessageId: null,
  editingContent: null,
}));

// Debounced save helper
let chatSaveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveChatHistory() {
  if (chatSaveTimer) clearTimeout(chatSaveTimer);
  chatSaveTimer = setTimeout(() => {
    const { projectId, messages, sessionId } = useAIChatStore.getState();
    if (projectId) {
      storageService.saveChatHistory({ projectId, messages, sessionId }).catch(() => {});
    }
  }, 500);
}

export function useAIChat() {
  const editor = useEditor();
  const {
    messages, sessionId, isLoading, error, projectId,
    editingMessageId, editingContent,
  } = useAIChatStore();
  const activeProject = editor.project.getActiveOrNull?.() ?? editor.project.getActive?.();
  const currentProjectId = activeProject?.metadata?.id ?? null;
  const loadedRef = useRef(false);

  // Load chat history when project changes
  useEffect(() => {
    if (!currentProjectId) return;
    if (useAIChatStore.getState().projectId === currentProjectId && loadedRef.current) return;

    loadedRef.current = true;
    useAIChatStore.setState({ projectId: currentProjectId });

    storageService.loadChatHistory({ projectId: currentProjectId }).then((data) => {
      if (data) {
        useAIChatStore.setState({
          messages: data.messages as ChatMessage[],
          sessionId: data.sessionId,
        });
      }
    }).catch(() => {});
  }, [currentProjectId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const state = useAIChatStore.getState();

    // Save a project snapshot BEFORE this message is sent
    let snapshotId: string | undefined;
    if (state.projectId) {
      try {
        const serialized = editor.project.serializeProject();
        if (serialized) {
          snapshotId = await storageService.saveVersionSnapshot({
            projectId: state.projectId,
            label: `Before: ${content.slice(0, 40)}`,
            project: serialized as any,
          });
        }
      } catch { /* snapshot failed — continue without it */ }
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
      snapshotId,
    };

    useAIChatStore.setState((s) => ({
      messages: [...s.messages, userMsg],
      isLoading: true,
      error: null,
      editingMessageId: null,
      editingContent: null,
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
        actionResults = await executeAIActions(data.actions);
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
      debouncedSaveChatHistory();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      useAIChatStore.setState({
        isLoading: false,
        error: errorMsg,
      });
    }
  }, [editor]);

  const startEditMessage = useCallback(async (messageId: string) => {
    const state = useAIChatStore.getState();
    if (state.isLoading) return;

    const msgIndex = state.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const message = state.messages[msgIndex];
    if (message.role !== "user") return;

    // Restore project to the snapshot taken before this message
    if (message.snapshotId && state.projectId) {
      try {
        const snapshot = await storageService.loadVersionSnapshot({
          projectId: state.projectId,
          snapshotId: message.snapshotId,
        });
        if (snapshot) {
          await restoreProjectFromSnapshot(editor, snapshot as any);
        }
      } catch (err) {
        console.error("Failed to restore snapshot:", err);
      }
    }

    // Truncate messages from this point, reset session for fresh AI context
    const truncatedMessages = state.messages.slice(0, msgIndex);

    useAIChatStore.setState({
      messages: truncatedMessages,
      sessionId: null,
      editingMessageId: messageId,
      editingContent: message.content,
      error: null,
    });

    debouncedSaveChatHistory();
  }, [editor]);

  const cancelEdit = useCallback(() => {
    useAIChatStore.setState({
      editingMessageId: null,
      editingContent: null,
    });
  }, []);

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
      debouncedSaveChatHistory();
    } catch (err) {
      console.error("Error adding media files:", err);
    }
  }, [editor]);

  const clearChat = useCallback(() => {
    useAIChatStore.setState({
      messages: [],
      sessionId: null,
      error: null,
      editingMessageId: null,
      editingContent: null,
    });
    debouncedSaveChatHistory();
  }, []);

  return {
    messages, sessionId, isLoading, error,
    editingMessageId, editingContent,
    sendMessage, clearChat, addMediaFiles,
    startEditMessage, cancelEdit,
  };
}
