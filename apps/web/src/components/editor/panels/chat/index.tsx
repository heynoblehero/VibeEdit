"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

function Avatar({ type }: { type: "user" | "ai" }) {
	if (type === "user") {
		return (
			<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
				<span className="text-xs font-medium text-orange-700 dark:text-orange-300">Y</span>
			</div>
		);
	}
	return (
		<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
			<span className="text-xs font-bold text-amber-700 dark:text-amber-300">AI</span>
		</div>
	);
}

function ChatMessageBubble({ message }: { message: ChatMessageType }) {
	if (message.role === "system") {
		return (
			<div className="flex justify-center mb-3">
				<div className="text-xs text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800/50 rounded-lg px-3 py-1.5 max-w-[90%]">
					<p className="whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		);
	}

	const isUser = message.role === "user";

	if (isUser) {
		return (
			<div className="flex gap-2.5 justify-end mb-4">
				<div className="max-w-[80%] rounded-2xl rounded-tr-md px-4 py-2.5 bg-stone-200 dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-200">
					<p className="whitespace-pre-wrap">{message.content}</p>
				</div>
				<Avatar type="user" />
			</div>
		);
	}

	return (
		<div className="flex gap-2.5 mb-4">
			<Avatar type="ai" />
			<div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-2.5 bg-white dark:bg-stone-900 shadow-sm border border-stone-100 dark:border-stone-800 text-sm text-stone-700 dark:text-stone-300">
				<p className="whitespace-pre-wrap">{message.content}</p>
				{message.actions && message.actions.length > 0 && (
					<div className="mt-2.5 flex flex-wrap gap-1.5">
						{message.actions.map((action, i) => {
							const result = message.actionResults?.[i];
							const ok = result?.success;
							return (
								<span
									key={i}
									className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono ${
										ok
											? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
											: "bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400"
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
		e.target.value = "";
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
		const el = e.target;
		el.style.height = "auto";
		el.style.height = Math.min(el.scrollHeight, 120) + "px";
	};

	return (
		<div className="flex h-full flex-col bg-stone-50 dark:bg-stone-950">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-4 h-12 shrink-0">
				<div className="flex items-center gap-2">
					<div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
						<span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">AI</span>
					</div>
					<span className="text-sm font-medium text-stone-700 dark:text-stone-300">VibeEdit AI</span>
				</div>
				<button
					onClick={clearChat}
					className="rounded-md px-2 py-1 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
				>
					Clear
				</button>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4">
				{messages.length === 0 && !isLoading && (
					<div className="flex flex-col items-center justify-center h-full text-center px-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
								<path d="M12 8V4H8" />
								<rect width="16" height="12" x="4" y="8" rx="2" />
								<path d="m2 14 6-6" />
								<path d="m14 20 8-8" />
							</svg>
						</div>
						<p className="font-medium text-stone-700 dark:text-stone-300 mb-1">VibeEdit AI</p>
						<p className="text-xs text-stone-400 leading-relaxed">
							Drop media files here, then tell me<br />what to create. I handle text, cuts,<br />effects, keyframes, and more.
						</p>
					</div>
				)}
				{messages.map((msg) => (
					<ChatMessageBubble key={msg.id} message={msg} />
				))}
				{isLoading && (
					<div className="flex gap-2.5 mb-4">
						<Avatar type="ai" />
						<div className="rounded-2xl rounded-tl-md px-4 py-3 bg-white dark:bg-stone-900 shadow-sm border border-stone-100 dark:border-stone-800">
							<div className="flex gap-1.5">
								<div className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: "0ms" }} />
								<div className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: "150ms" }} />
								<div className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: "300ms" }} />
							</div>
						</div>
					</div>
				)}
				{error && (
					<div className="bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-xl px-4 py-2.5 text-xs mb-3">
						{error}
					</div>
				)}
			</div>

			{/* Input */}
			<div className="border-t border-stone-200 dark:border-stone-800 p-3 shrink-0">
				<div
					className={`flex items-end gap-2 rounded-xl border p-2 shadow-sm transition-colors ${
						isDragging
							? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
							: "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
					}`}
					onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
					onDragLeave={() => setIsDragging(false)}
					onDrop={handleDrop}
				>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="shrink-0 rounded-lg p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
						title="Attach media files"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
					</button>
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder="Tell me what to edit..."
						disabled={isLoading}
						rows={1}
						className="flex-1 resize-none bg-transparent text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none disabled:opacity-50 min-h-[36px] max-h-[120px] py-1.5"
					/>
					<button
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
						className="shrink-0 rounded-lg p-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
						</svg>
					</button>
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
