"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";

/* ── Avatars ── */
function Avatar({ type }: { type: "user" | "ai" }) {
	if (type === "user") {
		return (
			<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
				<span className="text-xs font-medium text-primary">Y</span>
			</div>
		);
	}
	return (
		<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ring/15">
			<span className="text-xs font-bold text-ring">AI</span>
		</div>
	);
}

/* ── Media Attachment Pill (shown after uploading) ── */
function MediaPill({ name, type, duration }: { name: string; type: string; duration?: number }) {
	const icon = type === "video" ? "\u{1F3AC}" : type === "audio" ? "\u{1F3B5}" : "\u{1F5BC}\uFE0F";
	const durStr = duration ? ` \u00B7 ${duration.toFixed(1)}s` : "";
	return (
		<div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
			<span>{icon}</span>
			<span className="font-medium text-foreground truncate max-w-[140px]">{name}</span>
			<span className="text-muted-foreground">{type}{durStr}</span>
		</div>
	);
}

/* ── Chat Message Bubble ── */
function ChatMessageBubble({ message }: { message: ChatMessageType }) {
	if (message.role === "system") {
		return (
			<div className="flex justify-center mb-3">
				<div className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-1.5 max-w-[90%]">
					<p className="whitespace-pre-wrap">{message.content}</p>
					{/* Render media pills if system message contains file info */}
					{message.attachments && message.attachments.length > 0 && (
						<div className="flex flex-wrap gap-1.5 mt-2">
							{message.attachments.map((a, i) => (
								<MediaPill key={i} name={a.name} type={a.type} duration={a.duration} />
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	const isUser = message.role === "user";

	if (isUser) {
		return (
			<div className="flex gap-2.5 justify-end mb-4">
				<div className="max-w-[80%] rounded-2xl rounded-tr-md px-4 py-2.5 bg-secondary text-sm text-foreground">
					<p className="whitespace-pre-wrap">{message.content}</p>
				</div>
				<Avatar type="user" />
			</div>
		);
	}

	return (
		<div className="flex gap-2.5 mb-4">
			<Avatar type="ai" />
			<div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-2.5 bg-card shadow-sm border border-border text-sm text-foreground">
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

/* ── Main Chat Panel ── */
export function ChatPanel() {
	const { messages, isLoading, error, sendMessage, clearChat } = useAIChat();
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [input, setInput] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
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
		setIsUploading(true);
		try {
			const regularFiles: File[] = [];
			let specialCount = 0;

			for (const file of files) {
				const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";

				if (ext === ".zip") {
					// Extract ZIP asset pack
					const { extractZipAssets } = await import("@/lib/media/zip-import");
					const extracted = await extractZipAssets(file, ({ currentFile }) => {
						toast.info(`Extracting: ${currentFile}`);
					});

					for (const item of extracted) {
						if (item.type === "lut") {
							// Parse and register LUT
							const { parseCubeLUT, registerLUT } = await import("@/lib/media/lut-parser");
							const text = await item.file.text();
							const lut = parseCubeLUT(text);
							registerLUT(crypto.randomUUID(), lut);
							specialCount++;
						} else if (item.type === "lottie") {
							// Add Lottie as image asset (rendered via lottie-web later)
							regularFiles.push(item.file);
						} else if (item.type !== "unknown") {
							regularFiles.push(item.file);
						}
					}
					toast.success(`Extracted ${extracted.length} files from ${file.name}`);

				} else if (ext === ".cube" || ext === ".3dl") {
					// Parse LUT file
					const { parseCubeLUT, registerLUT } = await import("@/lib/media/lut-parser");
					const text = await file.text();
					const lut = parseCubeLUT(text);
					const lutId = crypto.randomUUID();
					registerLUT(lutId, lut);
					toast.success(`Loaded LUT: ${lut.title}`);
					specialCount++;

				} else if (ext === ".psd") {
					// Extract PSD layers
					const { readPsd } = await import("ag-psd");
					const buffer = await file.arrayBuffer();
					const psd = readPsd(buffer);
					if (psd.children) {
						for (const layer of psd.children) {
							if (layer.canvas) {
								const blob = await new Promise<Blob>((resolve) => {
									layer.canvas!.toBlob((b) => resolve(b!), "image/png");
								});
								const layerFile = new File([blob], `${layer.name || "layer"}.png`, { type: "image/png" });
								regularFiles.push(layerFile);
							}
						}
						toast.success(`Extracted ${psd.children.length} layers from ${file.name}`);
					}

				} else {
					regularFiles.push(file);
				}
			}

			// Process regular media files
			if (regularFiles.length > 0) {
				const processedAssets = await processMediaAssets({ files: regularFiles, onProgress: () => {} });
				for (const asset of processedAssets) {
					await editor.media.addMediaAsset({ projectId: activeProject.metadata.id, asset });
				}

				const summary = processedAssets.map(a => {
					const dur = a.duration ? ` (${a.duration.toFixed(1)}s)` : "";
					return `${a.name}${dur}`;
				}).join(", ");
				if (processedAssets.length > 0) toast.success(`Added: ${summary}`);
			}

			if (specialCount > 0) toast.success(`Loaded ${specialCount} special asset(s) (LUTs, etc.)`);
		} catch (err) {
			console.error("Error processing files:", err);
			toast.error("Failed to process files");
		} finally {
			setIsUploading(false);
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
		<div className="flex h-full flex-col bg-background">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-5 h-14 shrink-0">
				<div className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-full bg-ring/15">
						<span className="text-[11px] font-bold text-ring">AI</span>
					</div>
					<div>
						<span className="text-sm font-semibold text-foreground">VibeEdit</span>
					</div>
				</div>
				<button
					onClick={clearChat}
					className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				>
					Clear
				</button>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
				{messages.length === 0 && !isLoading && (
					<div className="flex flex-col items-center justify-center h-full text-center px-8">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ring/10 mb-5">
							<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ring">
								<path d="M12 8V4H8" />
								<rect width="16" height="12" x="4" y="8" rx="2" />
								<path d="m2 14 6-6" />
								<path d="m14 20 8-8" />
							</svg>
						</div>
						<p className="text-base font-semibold text-foreground mb-2">What do you want to create?</p>
						<p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
							Attach your media files below, then describe your video. I&apos;ll handle the editing.
						</p>
						<div className="flex flex-wrap gap-2 mt-5 text-xs text-muted-foreground">
							<span className="rounded-full border border-border px-3 py-1">&quot;add intro as main&quot;</span>
							<span className="rounded-full border border-border px-3 py-1">&quot;overlay logo 2s-5s&quot;</span>
							<span className="rounded-full border border-border px-3 py-1">&quot;fade in text&quot;</span>
						</div>
					</div>
				)}
				{messages.map((msg) => (
					<ChatMessageBubble key={msg.id} message={msg} />
				))}
				{isLoading && (
					<div className="flex gap-2.5 mb-4">
						<Avatar type="ai" />
						<div className="rounded-2xl rounded-tl-md px-4 py-3 bg-card shadow-sm border border-border">
							<div className="flex gap-1.5">
								<div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
								<div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
								<div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
							</div>
						</div>
					</div>
				)}
				{error && (
					<div className="bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-xs mb-3">
						{error}
					</div>
				)}
			</div>

			{/* Input area */}
			<div className="border-t border-border px-4 py-3 shrink-0">
				{isUploading && (
					<div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
						<div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
						Processing media...
					</div>
				)}
				<div
					className={`flex items-end gap-2 rounded-xl border p-2.5 transition-all ${
						isDragging
							? "border-primary bg-primary/5 shadow-md"
							: "border-border bg-card shadow-sm"
					}`}
					onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
					onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
					onDrop={handleDrop}
				>
					{/* Attach button */}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						title="Attach media files (video, image, audio)"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
					</button>

					{/* Text input */}
					<textarea
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						placeholder={isDragging ? "Drop files here..." : "Describe what to edit..."}
						disabled={isLoading || isUploading}
						rows={1}
						className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[36px] max-h-[120px] py-1.5"
					/>

					{/* Send button */}
					<button
						onClick={handleSend}
						disabled={!input.trim() || isLoading || isUploading}
						className="shrink-0 rounded-lg p-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						title="Send"
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
					accept="image/*,video/*,audio/*,.zip,.cube,.3dl,.psd,.json"
					onChange={handleFileSelect}
				/>
			</div>
		</div>
	);
}
