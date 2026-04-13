"use client";

import { useState, useRef, useEffect } from "react";
import { useAIChat } from "@/hooks/use-ai-chat";
import { PanelView } from "./base-view";
import { PlanView } from "./plan-view";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

function ChatMessageBubble({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground"
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.plan && (
          <div className="mt-2">
            <PlanView plan={message.plan} />
          </div>
        )}
        {message.actions && message.actions.length > 0 && !message.plan && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.actions.map((action, i) => {
              const result = message.actionResults?.[i];
              const ok = result?.success;
              return (
                <span key={i} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                  ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {ok ? "\u2713" : "\u2717"} {action.tool}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChatView() {
  const { messages, isLoading, error, sendMessage, clearChat } = useAIChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PanelView
      title="AI Assistant"
      actions={
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs text-muted-foreground">
          Clear
        </Button>
      }
    >
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
              <p className="font-medium mb-1">AI Video Editor</p>
              <p className="text-xs">Tell me what to do with your video. I can add text, images, keyframes, effects, and more.</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-2 shrink-0">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what to edit..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="shrink-0"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </PanelView>
  );
}
