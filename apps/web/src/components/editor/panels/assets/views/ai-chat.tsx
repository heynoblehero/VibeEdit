"use client";

import { useState, useRef, useEffect } from "react";
import { useAIChat } from "@/hooks/use-ai-chat";
import { PanelView } from "./base-view";
import { PlanView } from "./plan-view";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-1 inline-flex items-center rounded p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy message"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
      )}
    </button>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground"
      }`}>
        <div className="flex items-start gap-1">
          <p className="whitespace-pre-wrap flex-1">{message.content}</p>
          <CopyButton text={message.content} />
        </div>
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

function VoiceButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled: boolean }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript;
      if (text) onTranscript(text);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Check if speech recognition is available
  const available = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!available) return null;

  return (
    <Button
      onClick={toggle}
      disabled={disabled}
      size="sm"
      variant={isListening ? "destructive" : "outline"}
      className="shrink-0 w-9 p-0"
      title={isListening ? "Stop listening" : "Voice input"}
    >
      {isListening ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      )}
    </Button>
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
              placeholder="Tell me what to edit... (or click mic)"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <VoiceButton onTranscript={(text) => { setInput((prev) => prev ? prev + " " + text : text); }} disabled={isLoading} />
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
