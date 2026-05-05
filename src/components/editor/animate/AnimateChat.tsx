"use client";

import { Loader2, RotateCcw, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Kbd, modKey } from "@/components/ui/Kbd";
import {
	ANIMATION_TEMPLATES,
	type AnimationSpec,
	type AnimationTemplateId,
	makeDefaultSpec,
} from "@/lib/animate/spec";
import { cls } from "@/lib/design/tokens";
import { toast } from "@/lib/toast";
import { useActivityStore } from "@/store/activity-store";
import { useAiStatusStore } from "@/store/ai-status-store";
import { useProjectStore } from "@/store/project-store";
import { usePromptHistoryStore } from "@/store/prompt-history-store";

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	specId?: string;
	at?: number;
	/** Token + cost meter for assistant turns. Populated post-stream. */
	usage?: {
		inputTokens: number;
		outputTokens: number;
		usd: number;
	};
}

interface Props {
	currentSpec: AnimationSpec | null;
	onSpec: (spec: AnimationSpec) => void;
}

/**
 * Chat sidebar for the Animate workspace. Posts to /api/animate/chat,
 * receives a structured AnimationSpec, and forwards it to the parent.
 *
 * History persists on `project.animateChatHistory` so reload doesn't
 * lose the conversation. The "start blank" tiles seed history with a
 * synthetic assistant message so the user feels in dialogue from the
 * first action.
 */
export function AnimateChat({ currentSpec, onSpec }: Props) {
	const project = useProjectStore((s) => s.project);
	const setHistory = useProjectStore((s) => s.setAnimateChatHistory);
	const persisted = project.animateChatHistory ?? [];

	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [busy, streamingText]);

	const append = (msgs: ChatMessage[]) => {
		setHistory([...persisted, ...msgs]);
	};

	const send = () => {
		const prompt = draft.trim();
		if (!prompt || busy) return;
		setDraft("");
		usePromptHistoryStore.getState().push("animate", prompt);
		runPrompt(prompt, persisted);
	};

	const regenerate = (prompt: string, history: ChatMessage[]) => {
		runPrompt(prompt, history);
	};

	const runPrompt = async (
		prompt: string,
		baseHistory: ChatMessage[],
	) => {
		const userMsg: ChatMessage = {
			role: "user",
			content: prompt,
			at: Date.now(),
		};
		const apiHistory = baseHistory.map((m) => ({
			role: m.role,
			content: m.content,
		}));
		setHistory([...baseHistory, userMsg]);
		setBusy(true);
		setStreamingText("");
		const taskId = `animate-${Date.now()}`;
		useAiStatusStore.getState().start({
			id: taskId,
			kind: "animation",
			label: `Animate · ${prompt.slice(0, 32)}${prompt.length > 32 ? "…" : ""}`,
		});
		try {
			const res = await fetch("/api/animate/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt,
					history: apiHistory,
					canvas: { fps: project.fps, width: project.width, height: project.height },
				}),
			});
			if (!res.ok || !res.body) {
				const err = await res.json().catch(() => null);
				throw new Error(err?.error ?? `chat failed (${res.status})`);
			}

			// Consume SSE stream — `text` events mutate streamingText for
			// live token feedback; `done` finalizes the assistant message
			// and forwards the spec; `error` raises.
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let liveText = "";
			let finalMessage: string | null = null;
			let finalSpec: AnimationSpec | null = null;
			let finalUsage: ChatMessage["usage"] | undefined;
			let streamErr: string | null = null;

			outer: while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let idx: number;
				// biome-ignore lint/suspicious/noAssignInExpressions: SSE frame splitting on \n\n
				while ((idx = buffer.indexOf("\n\n")) !== -1) {
					const frame = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 2);
					const line = frame.split("\n").find((l) => l.startsWith("data: "));
					if (!line) continue;
					try {
						const event = JSON.parse(line.slice(6));
						if (event.type === "text") {
							liveText += event.delta as string;
							setStreamingText(liveText);
						} else if (event.type === "done") {
							finalMessage = event.message;
							finalSpec = event.spec;
							finalUsage = event.usage;
							break outer;
						} else if (event.type === "error") {
							streamErr = event.error;
							break outer;
						}
					} catch {
						// ignore malformed frame
					}
				}
			}

			if (streamErr) throw new Error(streamErr);

			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: finalMessage || liveText || "Generated.",
				specId: finalSpec?.id,
				at: Date.now(),
				usage: finalUsage,
			};
			setHistory([...baseHistory, userMsg, assistantMsg]);
			setStreamingText("");

			if (finalSpec) {
				onSpec({ ...finalSpec, prompt });
				useActivityStore.getState().log({
					projectId: project.id,
					kind: "ai-edit",
					label: `AI animation · ${finalSpec.name ?? "spec"}`,
				});
			}
			if (finalUsage) {
				useAiStatusStore.getState().addSpend(finalUsage.usd);
			}
			if (!finalSpec) {
				toast.error("AI couldn't produce a spec", {
					description: "Try rephrasing or pick a template tile to start.",
				});
			}
		} catch (e) {
			toast.error("Generation failed", {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setBusy(false);
			setStreamingText("");
			useAiStatusStore.getState().end(taskId);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			send();
		}
	};

	const startBlank = (templateId: AnimationTemplateId) => {
		const spec = makeDefaultSpec(templateId, {
			fps: project.fps,
			width: project.width,
			height: project.height,
		});
		onSpec(spec);
		append([
			{
				role: "assistant",
				content: `Started with the "${ANIMATION_TEMPLATES[templateId].label}" template. Tweak the prompt to customize, or edit props in the inspector on the right.`,
				specId: spec.id,
				at: Date.now(),
			},
		]);
	};

	const clearHistory = () => {
		setHistory([]);
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-fuchsia-500/30">
				<div className="flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
					<span className="text-[11px] uppercase tracking-wider text-fuchsia-300 font-semibold">
						Chat with AI
					</span>
				</div>
				{persisted.length > 0 ? (
					<Button
						variant="ghost"
						size="xs"
						onClick={clearHistory}
						className="text-[10px]"
					>
						Clear
					</Button>
				) : null}
			</div>
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
				{persisted.length === 0 ? (
					<div className="space-y-3">
						<div className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 space-y-2">
							<div className="text-[12px] text-fuchsia-100">
								Describe a motion graphic — title cards, lower thirds, big
								numbers, quotes, bullet lists, logo reveals.
							</div>
							<div className="text-[11px] text-neutral-400 leading-relaxed">
								e.g. <em>"Big number reveal counting up to 12,500 with the label
								'monthly users' in fuchsia"</em>
							</div>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
								Or start blank
							</div>
							<div className="grid grid-cols-2 gap-1.5">
								{Object.values(ANIMATION_TEMPLATES).map((tpl) => (
									<button
										key={tpl.id}
										type="button"
										onClick={() => startBlank(tpl.id)}
										className="px-2.5 py-2 rounded-md text-[11px] border border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-fuchsia-500/50 hover:text-fuchsia-200 hover:bg-fuchsia-500/5 transition-colors text-left"
									>
										<div className="font-medium">{tpl.label}</div>
										<div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">
											{tpl.blurb}
										</div>
									</button>
								))}
							</div>
						</div>
					</div>
				) : (
					persisted.map((m, i) => {
						const isLastAssistant =
							m.role === "assistant" && i === persisted.length - 1 && !busy;
						return (
							<div key={i}>
								<MessageBubble
									msg={m}
									highlighted={!!currentSpec && m.specId === currentSpec.id}
								/>
								{isLastAssistant ? (
									<div className="flex items-center justify-end mt-1 mr-1">
										<button
											type="button"
											onClick={() => {
												// Regenerate: chop the last assistant turn,
												// keep its preceding user prompt, re-send.
												const lastUser = [...persisted]
													.reverse()
													.find((x) => x.role === "user");
												if (!lastUser) return;
												const trimmed = persisted.slice(0, -1);
												setHistory(trimmed);
												setDraft(lastUser.content);
												requestAnimationFrame(() => {
													setDraft("");
													// Re-run with the original prompt directly.
													regenerate(lastUser.content, trimmed.slice(0, -1));
												});
											}}
											className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-fuchsia-300/80 hover:text-fuchsia-200 hover:bg-fuchsia-500/10"
											title="Regenerate this response"
										>
											<RotateCcw className="h-3 w-3" />
											Regenerate
										</button>
									</div>
								) : null}
							</div>
						);
					})
				)}
				{busy && streamingText ? (
					<MessageBubble
						msg={{ role: "assistant", content: stripJsonFromStream(streamingText) || "…" }}
						highlighted={false}
					/>
				) : null}
				{busy && !streamingText ? (
					<div className="flex items-center gap-2 text-[12px] text-fuchsia-200">
						<Loader2 className="h-3 w-3 animate-spin" />
						Thinking…
					</div>
				) : null}
			</div>
			<div className="border-t border-fuchsia-500/30 p-3 space-y-2">
				<RecentPromptChips
					onPick={(p) => setDraft(p)}
					show={draft.length === 0 && !busy}
				/>
				<Textarea
					accent="animate"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={onKeyDown}
					rows={3}
					placeholder="Describe an animation…"
					disabled={busy}
				/>
				<div className="flex items-center justify-between gap-2">
					<span className="text-[10px] text-neutral-500 flex items-center gap-1">
						<Kbd keys={[modKey(), "⏎"]} /> to send
					</span>
					<Button
						variant="primary"
						accent="animate"
						size="sm"
						onClick={send}
						disabled={!draft.trim()}
						loading={busy}
						leadingIcon={!busy && <Send className="h-3.5 w-3.5" />}
					>
						{busy ? "Thinking…" : "Send"}
					</Button>
				</div>
			</div>
		</div>
	);
}

/**
 * While streaming, the model often opens a ```json fence partway through;
 * we don't want the user to see raw JSON scrolling by, so strip an
 * already-opened (and possibly unclosed) fence from the live text.
 */
function stripJsonFromStream(raw: string): string {
	const fenceIdx = raw.indexOf("```");
	if (fenceIdx === -1) return raw;
	return raw.slice(0, fenceIdx).trimEnd();
}

function MessageBubble({
	msg,
	highlighted,
}: {
	msg: ChatMessage;
	highlighted: boolean;
}) {
	const isUser = msg.role === "user";
	return (
		<div className={cls("flex gap-2", isUser ? "flex-row-reverse" : "")}>
			<div
				className={cls(
					"shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
					isUser
						? "bg-neutral-800 text-neutral-300"
						: "bg-fuchsia-500/20 text-fuchsia-300",
				)}
			>
				{isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
			</div>
			<div
				className={cls(
					"flex-1 min-w-0 rounded-md px-2.5 py-1.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words",
					isUser
						? "bg-neutral-900 text-neutral-200"
						: highlighted
							? "bg-fuchsia-500/10 border border-fuchsia-500/40 text-fuchsia-100"
							: "bg-neutral-950 border border-neutral-800 text-neutral-300",
				)}
			>
				{msg.content}
				{msg.specId && !highlighted && msg.role === "assistant" ? (
					<div className="mt-1 text-[10px] text-neutral-500 italic">
						(no longer the active spec)
					</div>
				) : null}
				{msg.usage ? (
					<div className="mt-1 text-[9px] text-neutral-500 font-mono tabular-nums">
						{msg.usage.inputTokens + msg.usage.outputTokens} tokens · $
						{msg.usage.usd.toFixed(4)}
					</div>
				) : null}
			</div>
		</div>
	);
}

function RecentPromptChips({
	onPick,
	show,
}: {
	onPick: (prompt: string) => void;
	show: boolean;
}) {
	const recent = usePromptHistoryStore((s) => s.prompts.animate);
	if (!show || recent.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-1">
			{recent.slice(0, 5).map((p) => (
				<button
					key={p}
					type="button"
					onClick={() => onPick(p)}
					title={p}
					className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-950 border border-neutral-800 text-neutral-400 hover:border-fuchsia-500/40 hover:text-fuchsia-200 truncate max-w-[200px]"
				>
					{p.length > 36 ? `${p.slice(0, 33)}…` : p}
				</button>
			))}
		</div>
	);
}
