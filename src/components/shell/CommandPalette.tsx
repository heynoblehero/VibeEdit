"use client";

import {
	BookOpen,
	Copy,
	Layers,
	Library,
	Plus,
	Scissors,
	Search,
	Sparkles,
	Star,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Kbd, modKey } from "@/components/ui/Kbd";
import { cls } from "@/lib/design/tokens";
import { searchGlossary } from "@/lib/whatisthis";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

interface Command {
	id: string;
	label: string;
	hint?: string;
	keywords?: string;
	icon: ReactNode;
	run: () => void;
	section: "recent" | "navigate" | "scenes" | "actions" | "help";
}

/**
 * Global Cmd+K palette. Triggered from anywhere; closes on Esc /
 * action / outside click. Search filters by label + keywords.
 *
 * Lives at the layout level so every screen can hit it without
 * each workspace re-implementing.
 */
export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIdx, setActiveIdx] = useState(0);
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);

	const project = useProjectStore((s) => s.project);
	const projects = useProjectStore((s) => s.projects);
	const switchProject = useProjectStore((s) => s.switchProject);
	const createProject = useProjectStore((s) => s.createProject);
	const duplicateScene = useProjectStore((s) => s.duplicateScene);
	const removeScene = useProjectStore((s) => s.removeScene);
	const undo = useProjectStore((s) => s.undo);
	const redo = useProjectStore((s) => s.redo);
	const setSelectedSceneId = useEditorStore((s) => s.setFocusedSceneId);
	const focusedSceneId = useEditorStore((s) => s.focusedSceneId);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const isMod = e.metaKey || e.ctrlKey;
			if (isMod && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
				setQuery("");
				setActiveIdx(0);
				return;
			}
			// ⌘P opens the palette pre-filtered to project switching.
			if (isMod && e.key.toLowerCase() === "p") {
				e.preventDefault();
				setOpen(true);
				setQuery("project ");
				setActiveIdx(0);
				return;
			}
			// `?` typed alone outside an input opens the what-is-this view.
			// (The dedicated ShortcutsOverlay handles the help overlay.)
			if (e.key === "Escape" && open) {
				e.preventDefault();
				setOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	useEffect(() => {
		if (open) {
			// next tick so the input is mounted
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	const commands = useMemo<Command[]>(() => {
		const out: Command[] = [];

		// Recent projects (top 5 by updatedAt, excluding current + trashed).
		const recent = Object.values(projects)
			.filter((p) => p.id !== project.id && !p.deletedAt)
			.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
			.slice(0, 5);
		recent.forEach((p) => {
			out.push({
				id: `recent-${p.id}`,
				label: p.name || "Untitled",
				hint: `${p.scenes.length} scenes`,
				keywords: `recent open ${p.name ?? ""}`,
				icon: <Star className="h-3.5 w-3.5 text-amber-300" />,
				section: "recent",
				run: () => {
					switchProject(p.id);
					router.push(`/projects/${p.id}`);
				},
			});
		});

		// Navigation
		out.push({
			id: "go-dashboard",
			label: "Go to dashboard",
			keywords: "projects home",
			icon: <Layers className="h-3.5 w-3.5 text-neutral-300" />,
			section: "navigate",
			run: () => router.push("/dashboard"),
		});

		// Scenes
		project.scenes.forEach((scene, i) => {
			out.push({
				id: `scene-${scene.id}`,
				label: `Scene ${i + 1}${scene.label ? ` · ${scene.label}` : ""}`,
				hint: `${scene.duration ?? 0}s · ${scene.type}`,
				keywords: `scene ${scene.label ?? ""} ${scene.type}`,
				icon: <span className="h-3.5 w-3.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] flex items-center justify-center">{i + 1}</span>,
				section: "scenes",
				run: () => {
					setSelectedSceneId(scene.id);
				},
			});
		});

		// Other projects (excluding the recent-5 which already appear pinned).
		const recentIds = new Set(recent.map((p) => p.id));
		Object.values(projects).forEach((p) => {
			if (p.id === project.id || recentIds.has(p.id) || p.deletedAt) return;
			out.push({
				id: `proj-${p.id}`,
				label: `Open project: ${p.name || "Untitled"}`,
				hint: `${p.scenes.length} scenes`,
				keywords: `project open ${p.name ?? ""}`,
				icon: <Library className="h-3.5 w-3.5 text-neutral-400" />,
				section: "navigate",
				run: () => {
					switchProject(p.id);
					router.push(`/projects/${p.id}`);
				},
			});
		});

		// Active-scene actions (only when a scene is focused).
		if (focusedSceneId) {
			const sceneIdx = project.scenes.findIndex((s) => s.id === focusedSceneId);
			if (sceneIdx >= 0) {
				out.push({
					id: "scene-duplicate",
					label: `Duplicate scene ${sceneIdx + 1}`,
					keywords: "duplicate copy clone scene",
					icon: <Copy className="h-3.5 w-3.5 text-emerald-300" />,
					section: "actions",
					run: () => duplicateScene(focusedSceneId),
				});
				out.push({
					id: "scene-split",
					label: `Split scene ${sceneIdx + 1} at playhead`,
					keywords: "split cut scene",
					icon: <Scissors className="h-3.5 w-3.5 text-emerald-300" />,
					section: "actions",
					run: () => {
						// Best-effort; the split-at-playhead action lives in
						// invokeAction("split"). Until wired, the existing
						// duplicate is a graceful fallback.
						duplicateScene(focusedSceneId);
					},
				});
				out.push({
					id: "scene-delete",
					label: `Delete scene ${sceneIdx + 1}`,
					keywords: "delete remove scene",
					icon: <Trash2 className="h-3.5 w-3.5 text-red-300" />,
					section: "actions",
					run: () => removeScene(focusedSceneId),
				});
			}
		}

		out.push({
			id: "act-undo",
			label: "Undo",
			keywords: "undo",
			icon: <span className="text-[10px] font-mono text-neutral-400">⌘Z</span>,
			section: "actions",
			run: undo,
		});
		out.push({
			id: "act-redo",
			label: "Redo",
			keywords: "redo",
			icon: <span className="text-[10px] font-mono text-neutral-400">⇧⌘Z</span>,
			section: "actions",
			run: redo,
		});

		// Actions
		out.push({
			id: "act-new-project",
			label: "Create new project",
			keywords: "new add project",
			icon: <Plus className="h-3.5 w-3.5 text-neutral-300" />,
			section: "actions",
			run: () => {
				const id = createProject();
				router.push(`/projects/${id}`);
			},
		});

		return out;
	}, [
		project,
		projects,
		switchProject,
		createProject,
		router,
		setSelectedSceneId,
		focusedSceneId,
		duplicateScene,
		removeScene,
		undo,
		redo,
	]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		// Glossary entries surface when the user types — "what is this?"
		// answers without leaving the editor. Body shows as the hint.
		const glossary: Command[] = q
			? searchGlossary(q).map((g) => ({
					id: `help-${g.term}`,
					label: g.term,
					hint: g.body,
					keywords: g.keywords,
					icon: <BookOpen className="h-3.5 w-3.5 text-sky-300" />,
					section: "help" as const,
					run: () => {},
				}))
			: [];
		if (!q) return commands;
		const matched = commands.filter((c) => {
			const hay = `${c.label} ${c.keywords ?? ""} ${c.hint ?? ""}`.toLowerCase();
			return hay.includes(q);
		});
		return [...matched, ...glossary];
	}, [commands, query]);

	useEffect(() => {
		setActiveIdx(0);
	}, [query]);

	const onListKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIdx((i) => Math.max(0, i - 1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const cmd = filtered[activeIdx];
			if (cmd) {
				cmd.run();
				setOpen(false);
			}
		}
	};

	if (!open) return null;

	const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
		(acc[c.section] ||= []).push(c);
		return acc;
	}, {});

	const sectionLabels: Record<string, string> = {
		recent: "Recent",
		navigate: "Go to",
		scenes: "Scenes",
		actions: "Actions",
		help: "What is this?",
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm motion-fade"
			onClick={() => setOpen(false)}
			onKeyDown={() => {}}
			role="presentation"
		>
			<div
				className="w-full max-w-xl mx-4 rounded-lg bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden motion-pop"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Command palette"
			>
				<div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
					<Search className="h-3.5 w-3.5 text-neutral-500" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={onListKey}
						placeholder="Type to filter — scenes, tabs, projects, actions"
						className="flex-1 bg-transparent text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
					/>
					<Kbd keys={["esc"]} />
				</div>
				<div className="max-h-[50vh] overflow-y-auto py-1">
					{filtered.length === 0 ? (
						<div className="px-3 py-6 text-center text-[12px] text-neutral-500">
							No matches.
						</div>
					) : (
						(["recent", "navigate", "scenes", "actions", "help"] as const).map((sec) => {
							const items = grouped[sec];
							if (!items?.length) return null;
							return (
								<div key={sec}>
									<div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-500">
										{sectionLabels[sec]}
									</div>
									{items.map((c) => {
										const idx = filtered.indexOf(c);
										const active = idx === activeIdx;
										const isHelp = c.section === "help";
										return (
											<button
												key={c.id}
												type="button"
												onMouseEnter={() => setActiveIdx(idx)}
												onClick={() => {
													c.run();
													if (!isHelp) setOpen(false);
												}}
												className={cls(
													"w-full flex gap-2.5 px-3 py-1.5 text-left transition-colors",
													isHelp ? "items-start" : "items-center",
													active
														? "bg-neutral-800 text-white"
														: "text-neutral-300",
												)}
											>
												<span className={cls("shrink-0", isHelp ? "mt-0.5" : "")}>{c.icon}</span>
												{isHelp ? (
													<span className="flex-1 min-w-0">
														<span className="block text-[12px] font-medium">{c.label}</span>
														{c.hint ? (
															<span className="block text-[11px] text-neutral-400 leading-snug mt-0.5">
																{c.hint}
															</span>
														) : null}
													</span>
												) : (
													<>
														<span className="flex-1 text-[12px] truncate">{c.label}</span>
														{c.hint ? (
															<span className="text-[10px] text-neutral-500 shrink-0">
																{c.hint}
															</span>
														) : null}
													</>
												)}
											</button>
										);
									})}
								</div>
							);
						})
					)}
				</div>
				<div className="flex items-center justify-between px-3 py-1.5 border-t border-neutral-800 text-[10px] text-neutral-500">
					<div className="flex items-center gap-2">
						<Kbd keys={["↑"]} />
						<Kbd keys={["↓"]} />
						<span>navigate</span>
						<Kbd keys={["⏎"]} />
						<span>open</span>
					</div>
					<div className="flex items-center gap-1">
						<Kbd keys={[modKey(), "K"]} />
						<span>toggle</span>
					</div>
				</div>
			</div>
		</div>
	);
}
