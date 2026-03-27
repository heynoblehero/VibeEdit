"use client";

import { useState, useRef, useEffect } from "react";
import { useAIChat } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";
import { ManualToolsDrawer } from "./manual-tools-drawer";

function ChatMessageBubble({ message }: { message: ChatMessageType }) {
	const isUser = message.role === "user";
	return (
		<div
			className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
		>
			<div
				className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
					isUser
						? "bg-zinc-800 text-zinc-100"
						: "bg-muted text-foreground"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>
				{message.actions && message.actions.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{message.actions.map((action, i) => {
							const result = message.actionResults?.[i];
							const ok = result?.success;
							return (
								<span
									key={i}
									className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono ${
										ok
											? "bg-green-500/20 text-green-400"
											: "bg-red-500/20 text-red-400"
									}`}
								>
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

export function ChatPanel() {
	const { messages, isLoading, error, sendMessage, clearChat } = useAIChat();
	const [input, setInput] = useState("");
	const [drawerOpen, setDrawerOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isLoading]);

	const handleSend = () => {
		if (!input.trim() || isLoading) return;
		sendMessage(input.trim());
		setInput("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		// Auto-resize textarea
		const el = e.target;
		el.style.height = "auto";
		el.style.height = Math.min(el.scrollHeight, 120) + "px";
	};

	return (
		<div className="bg-background border-r flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="text-sm font-semibold">VibeEdit AI</h2>
				<Button
					variant="ghost"
					size="sm"
					onClick={clearChat}
					className="text-muted-foreground h-7 text-xs"
				>
					Clear
				</Button>
			</div>

			{/* Messages */}
			<div
				ref={scrollRef}
				className="scrollbar-thin flex-1 overflow-y-auto p-4"
			>
				{messages.length === 0 && !isLoading && (
					<div className="text-muted-foreground flex h-full flex-col items-center justify-center px-6 text-center">
						<div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M12 8V4H8" />
								<rect width="16" height="12" x="4" y="8" rx="2" />
								<path d="m2 14 6-6" />
								<path d="m14 20 8-8" />
							</svg>
						</div>
						<p className="mb-1 text-sm font-medium">
							Tell me what to create
						</p>
						<p className="text-xs leading-relaxed">
							I can add text, images, effects, keyframes, and
							more. Describe your vision and I&apos;ll build it.
						</p>
					</div>
				)}
				{messages.map((msg) => (
					<ChatMessageBubble key={msg.id} message={msg} />
				))}
				{isLoading && (
					<div className="mb-3 flex justify-start">
						<div className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
							<span className="animate-pulse">Thinking...</span>
						</div>
					</div>
				)}
				{error && (
					<div className="bg-destructive/10 text-destructive mb-3 rounded-lg px-3 py-2 text-xs">
						{error}
					</div>
				)}
			</div>

			{/* Input */}
			<div className="border-t p-3">
				<div className="flex gap-2">
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder="Tell me what to edit..."
						disabled={isLoading}
						rows={1}
						className="bg-background placeholder:text-muted-foreground focus:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-50"
					/>
					<Button
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
						size="sm"
						className="shrink-0 self-end"
					>
						Send
					</Button>
				</div>
			</div>

			{/* Manual Tools */}
			<div className="border-t px-3 py-2">
				<Button
					variant="outline"
					size="sm"
					className="w-full text-xs"
					onClick={() => setDrawerOpen(true)}
				>
					Manual Tools
				</Button>
			</div>

			<ManualToolsDrawer
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
			/>
		</div>
	);
}
