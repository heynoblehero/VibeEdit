"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";
import { X, Pencil, Sparkles } from "lucide-react";
import { VersionHistory } from "./version-history";

/* ── Avatars ── */
function Avatar({ type }: { type: "user" | "ai" }) {
	if (type === "user") {
		return (
			<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
				<span className="text-xs font-semibold text-primary">Y</span>
			</div>
		);
	}
	return (
		<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full gradient-primary shadow-[0_0_8px_hsl(262_83%_58%/0.2)]">
			<Sparkles className="h-3.5 w-3.5 text-white" />
		</div>
	);
}

/* ── Media Attachment Pill (shown after uploading) ── */
function MediaPill({ name, type, duration }: { name: string; type: string; duration?: number }) {
	const icon = type === "video" ? "\u{1F3AC}" : type === "audio" ? "\u{1F3B5}" : "\u{1F5BC}\uFE0F";
	const durStr = duration ? ` \u00B7 ${duration.toFixed(1)}s` : "";
	return (
		<div className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm px-2.5 py-1 text-xs">
			<span>{icon}</span>
			<span className="font-medium text-foreground truncate max-w-[140px]">{name}</span>
			<span className="text-muted-foreground">{type}{durStr}</span>
		</div>
	);
}

/* ── Chat Message Bubble ── */
function ChatMessageBubble({ message, onEdit }: { message: ChatMessageType; onEdit?: (messageId: string) => void }) {
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
			<div className="group flex gap-2.5 justify-end mb-4">
				{onEdit && message.snapshotId && (
					<button
						onClick={() => onEdit(message.id)}
						className="self-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
						title="Edit message (restores project to this point)"
					>
						<Pencil className="h-3.5 w-3.5" />
					</button>
				)}
				<div className="max-w-[80%] rounded-2xl rounded-tr-md px-4 py-2.5 bg-primary/8 border border-primary/15 text-sm text-foreground">
					<p className="whitespace-pre-wrap">{message.content}</p>
				</div>
				<Avatar type="user" />
			</div>
		);
	}

	return (
		<div className="flex gap-2.5 mb-4">
			<Avatar type="ai" />
			<div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-2.5 bg-card/60 backdrop-blur-sm border border-border/40 text-sm text-foreground">
				<p className="whitespace-pre-wrap">{message.content}</p>
				{message.actions && message.actions.length > 0 && (
					<div className="mt-2.5 flex flex-wrap gap-1.5">
						{message.actions.map((action, i) => {
							const result = message.actionResults?.[i];
							const ok = result?.success;
							return (
								<span
									key={i}
									title={!ok && result?.error ? result.error : undefined}
									className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-mono cursor-default transition-colors ${
										ok
											? "bg-accent-lime/10 text-accent-lime border border-accent-lime/20"
											: "bg-accent-pink/10 text-accent-pink border border-accent-pink/20"
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
	const {
		messages, isLoading, error, sendMessage, clearChat,
		editingMessageId, editingContent, startEditMessage, cancelEdit,
	} = useAIChat();
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [input, setInput] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Generate preview URLs for pending image files
	const pendingPreviews = useMemo(() => {
		return pendingFiles.map((file) => ({
			file,
			name: file.name,
			isImage: file.type.startsWith("image/"),
			url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
		}));
	}, [pendingFiles]);

	// Cleanup preview URLs on unmount or change
	useEffect(() => {
		return () => {
			pendingPreviews.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
		};
	}, [pendingPreviews]);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isLoading]);

	// Pre-populate input when editing a message
	useEffect(() => {
		if (editingContent !== null) {
			setInput(editingContent);
			if (textareaRef.current) {
				textareaRef.current.focus();
				textareaRef.current.style.height = "auto";
				textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
			}
		}
	}, [editingContent]);

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

				} else if (ext === ".srt" || ext === ".vtt") {
					// Import subtitles as timed text elements
					const { parseSubtitleFile } = await import("@/lib/media/subtitle-parser");
					const text = await file.text();
					const cues = parseSubtitleFile(text, file.name);

					// Insert each cue as a text element via the editor
					for (const cue of cues) {
						editor.timeline.insertElement({
							element: {
								type: "text" as const,
								content: cue.text,
								fontSize: 32,
								fontFamily: "Inter",
								color: "#ffffff",
								textAlign: "center" as const,
								fontWeight: "bold" as const,
								fontStyle: "normal" as const,
								textDecoration: "none" as const,
								background: { enabled: true, color: "#000000", paddingX: 12, paddingY: 6, cornerRadius: 4, offsetX: 0, offsetY: 0 },
								name: `Sub: ${cue.text.slice(0, 20)}`,
								duration: cue.endTime - cue.startTime,
								startTime: cue.startTime,
								trimStart: 0,
								trimEnd: 0,
								transform: { scale: 1, position: { x: 0, y: 350 }, rotate: 0 },
								opacity: 1,
							},
							placement: { mode: "auto", trackType: "text" },
						});
					}
					toast.success(`Imported ${cues.length} subtitles from ${file.name}`);
					specialCount++;

				} else if (ext === ".edl") {
					const { parseEDL } = await import("@/lib/media/edl-parser");
					const text = await file.text();
					const edl = parseEDL(text);
					toast.success(`Imported EDL: "${edl.title}" with ${edl.events.length} edits. Use AI to map clips to your media.`);
					specialCount++;

				} else if (ext === ".xml" || ext === ".fcpxml") {
					const { parseFCPXML } = await import("@/lib/media/fcpxml-parser");
					const text = await file.text();
					const timeline = parseFCPXML(text);
					toast.success(`Imported timeline: "${timeline.name}" — ${timeline.clips.length} clips, ${timeline.duration.toFixed(1)}s`);
					specialCount++;

				} else if (ext === ".vibeedit") {
					const { readProjectFile } = await import("@/lib/project/save-load");
					const project = await readProjectFile(file);
					toast.success(`Loaded project: "${project.name}" (${project.mediaAssets.length} assets referenced)`);
					// Note: actual media files need to be re-attached
					specialCount++;

				} else if (ext === ".ttf" || ext === ".otf" || ext === ".woff2") {
					// Load custom font
					const { loadCustomFont } = await import("@/lib/media/font-loader");
					const loaded = await loadCustomFont(file);
					toast.success(`Loaded font: ${loaded.name} (use as "${loaded.family}")`);
					specialCount++;

				} else if (ext === ".json") {
					try {
						const text = await file.text();
						const { parseLottieJSON, registerLottie } = await import("@/lib/media/lottie-utils");
						const result = parseLottieJSON(text);
						if (result.valid && result.metadata) {
							registerLottie(crypto.randomUUID(), JSON.parse(text));
							toast.success(`Loaded Lottie: ${result.metadata.name}`);
							specialCount++;
						} else {
							regularFiles.push(file);
						}
					} catch {
						regularFiles.push(file);
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
		if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
		e.target.value = "";
	};

	const removePendingFile = (index: number) => {
		setPendingFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSend = async () => {
		if ((!input.trim() && pendingFiles.length === 0) || isLoading) return;

		// Process pending files first
		if (pendingFiles.length > 0) {
			await addMediaFiles(pendingFiles);
			setPendingFiles([]);
		}

		// Send the text message if any
		if (input.trim()) {
			sendMessage(input.trim());
			setInput("");
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
			}
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
			<div className="flex items-center justify-between border-b border-border/30 px-5 h-14 shrink-0 glass-strong">
				<div className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary shadow-[0_0_10px_hsl(262_83%_58%/0.15)]">
						<Sparkles className="h-3.5 w-3.5 text-white" />
					</div>
					<div>
						<span className="text-sm font-semibold font-[family-name:var(--font-display)] text-foreground">VibeEdit</span>
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<VersionHistory
						projectId={activeProject?.metadata?.id ?? ""}
						onRestore={() => {
							clearChat();
						}}
					/>
					<button
						onClick={clearChat}
						className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
					>
						Clear
					</button>
				</div>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
				{messages.length === 0 && !isLoading && (
					<div className="flex flex-col items-center justify-center h-full text-center px-8">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-[0_0_20px_hsl(262_83%_58%/0.2)] mb-5">
							<Sparkles className="h-6 w-6 text-white" />
						</div>
						<p className="text-base font-semibold font-[family-name:var(--font-display)] text-foreground mb-2">What do you want to create?</p>
						<p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
							Attach your media files below, then describe your video. I&apos;ll handle the editing.
						</p>
						<div className="flex flex-wrap gap-2 mt-5 text-xs text-muted-foreground">
							<span className="rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1.5 hover:border-primary/30 transition-colors cursor-default">&quot;add intro as main&quot;</span>
							<span className="rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1.5 hover:border-primary/30 transition-colors cursor-default">&quot;overlay logo 2s-5s&quot;</span>
							<span className="rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3 py-1.5 hover:border-primary/30 transition-colors cursor-default">&quot;fade in text&quot;</span>
						</div>
					</div>
				)}
				{messages.map((msg) => (
					<ChatMessageBubble
						key={msg.id}
						message={msg}
						onEdit={!isLoading ? startEditMessage : undefined}
					/>
				))}
				{isLoading && (
					<div className="flex gap-2.5 mb-4">
						<Avatar type="ai" />
						<div className="rounded-2xl rounded-tl-md px-4 py-3 bg-card/60 backdrop-blur-sm border border-border/40">
							<div className="flex gap-1.5">
								<div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
								<div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
								<div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
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
			<div className="border-t border-border/30 shrink-0">
				{editingMessageId && (
					<div className="flex items-center justify-between gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
						<div className="flex items-center gap-2">
							<Pencil className="h-3.5 w-3.5 text-primary" />
							<span className="text-xs font-medium text-primary">Editing message — project restored to this point</span>
						</div>
						<button
							onClick={cancelEdit}
							className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
							title="Cancel edit"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
				)}
			<div className="px-4 py-3">
				{isUploading && (
					<div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
						<div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
						Processing media...
					</div>
				)}
				<div
					className={`rounded-xl border transition-all duration-200 ${
						isDragging
							? "border-primary/40 bg-primary/5 shadow-[0_0_15px_hsl(262_83%_58%/0.1)]"
							: "border-border/40 bg-card/60 backdrop-blur-sm"
					}`}
					onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
					onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
					onDrop={handleDrop}
				>
					{/* Pending file previews */}
					{pendingPreviews.length > 0 && (
						<div className="flex flex-wrap gap-2 px-2.5 pt-2.5">
							{pendingPreviews.map((preview, i) => (
								<div key={`${preview.name}-${i}`} className="group relative">
									{preview.isImage && preview.url ? (
										<div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted">
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
										</div>
									) : (
										<div className="flex h-16 items-center gap-1.5 rounded-lg border border-border bg-muted px-3">
											<span className="text-lg">{preview.file.type.startsWith("video/") ? "\u{1F3AC}" : preview.file.type.startsWith("audio/") ? "\u{1F3B5}" : "\u{1F4CE}"}</span>
											<span className="text-xs text-foreground truncate max-w-[80px]">{preview.name}</span>
										</div>
									)}
									<button
										type="button"
										onClick={() => removePendingFile(i)}
										className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
					)}

					<div className="flex items-end gap-2 p-2.5">
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
							disabled={(!input.trim() && pendingFiles.length === 0) || isLoading || isUploading}
							className="shrink-0 rounded-lg p-2 gradient-primary text-white hover:shadow-[0_0_12px_hsl(262_83%_58%/0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
							title="Send"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
							</svg>
						</button>
					</div>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					multiple
					accept="image/*,video/*,audio/*,.zip,.cube,.3dl,.psd,.json,.srt,.vtt,.ttf,.otf,.woff2,.edl,.xml,.fcpxml,.vibeedit"
					onChange={handleFileSelect}
				/>
			</div>
			</div>
		</div>
	);
}
