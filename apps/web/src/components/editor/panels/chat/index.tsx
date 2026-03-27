"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

function ChatMessageBubble({ message }: { message: ChatMessageType }) {
	if (message.role === "system") {
		return (
			<div className="flex justify-center mb-3">
				<div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 max-w-[90%]">
					<p className="whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		);
	}

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

export function ChatPanel({ onClose }: { onClose: () => void }) {
	const { messages, isLoading, error, sendMessage, clearChat } = useAIChat();
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [input, setInput] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isLoading]);

	const addMediaFiles = async (files: File[]) => {
		if (!activeProject) {
			toast.error("No active project");
			return;
		}
		try {
			const processedAssets = await processMediaAssets({
				files,
				onProgress: () => {},
			});
			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
			toast.success(`Imported ${processedAssets.length} file(s)`);
		} catch (err) {
			console.error("Error processing files:", err);
			toast.error("Failed to process files");
		}
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) await addMediaFiles(files);
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (files.length > 0) await addMediaFiles(files);
		e.target.value = ""; // reset for re-upload
	};

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
		<div className="bg-background flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="text-sm font-semibold">VibeEdit AI</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={clearChat}
						className="text-muted-foreground h-7 text-xs"
					>
						Clear
					</Button>
					<button
						onClick={onClose}
						className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						title="Close (Ctrl+K)"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
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
			<div className="border-t p-3 shrink-0">
				<div
					className={`flex items-end gap-2 rounded-lg border bg-muted/30 p-2 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
					onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
					onDragLeave={() => setIsDragging(false)}
					onDrop={handleDrop}
				>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						title="Attach media files"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
					</button>
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder="Tell me what to edit..."
						disabled={isLoading}
						rows={1}
						className="bg-transparent placeholder:text-muted-foreground flex-1 resize-none py-1.5 text-sm focus:outline-none disabled:opacity-50"
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
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					multiple
					accept="image/*,video/*,audio/*"
					onChange={handleFileSelect}
				/>
			</div>
		</div>
	);
}
