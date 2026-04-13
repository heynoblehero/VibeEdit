"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAIChat } from "@/hooks/use-ai-chat";

interface Command {
	id: string;
	label: string;
	category: string;
	shortcut?: string;
	action: string; // AI prompt to execute
}

const COMMANDS: Command[] = [
	// Quick actions
	{ id: "add-text", label: "Add text overlay", category: "Insert", action: "Add a white text overlay saying 'Title' centered at 0 seconds" },
	{ id: "add-bg", label: "Add black background", category: "Insert", action: "Create a black background for the full duration" },
	{ id: "add-title", label: "Add animated title", category: "Insert", action: "Add an animated title with cinematic style" },
	{ id: "add-lower-third", label: "Add lower third", category: "Insert", action: "Add a lower third name tag" },
	{ id: "add-subscribe", label: "Add subscribe button", category: "Insert", action: "Add a subscribe button animation" },
	// Editing
	{ id: "jump-cut", label: "Auto jump cut (remove silence)", category: "Edit", action: "Automatically detect and remove silent parts from the main video" },
	{ id: "add-transition", label: "Add transition between clips", category: "Edit", action: "Add a cross-dissolve transition between the clips" },
	{ id: "trim-start", label: "Trim start of clip", category: "Edit", action: "Trim the first 2 seconds from the main video clip" },
	{ id: "speed-up", label: "Speed up clip (2x)", category: "Edit", action: "Speed up the selected clip to 2x speed" },
	{ id: "slow-mo", label: "Slow motion (0.5x)", category: "Edit", action: "Apply slow motion at 0.5x speed to the selected clip" },
	// Captions & Audio
	{ id: "add-captions", label: "Add auto-captions", category: "Captions", action: "Add auto-generated captions to the video" },
	{ id: "add-music", label: "Add background music", category: "Audio", action: "Search for upbeat background music and add it to the timeline" },
	{ id: "ducking", label: "Duck music during speech", category: "Audio", action: "Lower the background music volume during speech" },
	// Effects
	{ id: "filter-cinematic", label: "Cinematic color grade", category: "Effects", action: "Apply a cinematic color filter to the main video" },
	{ id: "filter-warm", label: "Warm color tone", category: "Effects", action: "Apply a warm color filter" },
	{ id: "filter-bw", label: "Black & white", category: "Effects", action: "Make the video black and white" },
	{ id: "ken-burns", label: "Ken Burns zoom effect", category: "Effects", action: "Apply a slow Ken Burns zoom to the selected image" },
	{ id: "pip", label: "Picture-in-picture", category: "Effects", action: "Add a picture-in-picture overlay in the bottom-right corner" },
	// Export
	{ id: "export-youtube", label: "Export for YouTube", category: "Export", action: "Export settings for YouTube 1080p" },
	{ id: "export-tiktok", label: "Export for TikTok", category: "Export", action: "Smart reframe to 9:16 for TikTok" },
	{ id: "export-instagram", label: "Export for Instagram Reel", category: "Export", action: "Export settings for Instagram Reel" },
	// Plan
	{ id: "plan-youtube", label: "Plan: Full YouTube video", category: "Plan", action: "Create a plan for a complete YouTube video with intro, content clips, captions, background music, and outro" },
	{ id: "plan-tiktok", label: "Plan: TikTok from footage", category: "Plan", action: "Create a plan to edit my footage into a vertical TikTok with captions, trending music, and 60-second max duration" },
	{ id: "plan-highlight", label: "Plan: Highlight reel", category: "Plan", action: "Create a plan for a highlight reel from my clips with the best moments, transitions, and music" },
];

export function CommandPalette() {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const { sendMessage, isLoading } = useAIChat();

	const filtered = query.trim()
		? COMMANDS.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(query.toLowerCase()) ||
					cmd.category.toLowerCase().includes(query.toLowerCase()),
			)
		: COMMANDS;

	const execute = useCallback(
		(command: Command) => {
			if (isLoading) return;
			sendMessage(command.action);
			setIsOpen(false);
			setQuery("");
		},
		[sendMessage, isLoading],
	);

	const executeCustom = useCallback(() => {
		if (!query.trim() || isLoading) return;
		sendMessage(query.trim());
		setIsOpen(false);
		setQuery("");
	}, [query, sendMessage, isLoading]);

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "k") {
				event.preventDefault();
				setIsOpen((prev) => !prev);
				setQuery("");
				setSelectedIndex(0);
			}
			if (event.key === "Escape" && isOpen) {
				setIsOpen(false);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setSelectedIndex((prev) => Math.max(prev - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (filtered[selectedIndex]) {
				execute(filtered[selectedIndex]);
			} else if (query.trim()) {
				executeCustom();
			}
		}
	};

	if (!isOpen) return null;

	const categories = [...new Set(filtered.map((c) => c.category))];

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

			{/* Palette */}
			<div className="relative w-full max-w-lg rounded-xl border bg-popover shadow-2xl">
				{/* Search input */}
				<div className="flex items-center border-b px-4">
					<svg className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
					</svg>
					<input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search commands or type an AI prompt..."
						className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
					/>
					<kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
				</div>

				{/* Results */}
				<div className="max-h-[300px] overflow-y-auto p-2">
					{filtered.length === 0 && query.trim() && (
						<button
							onClick={executeCustom}
							className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
						>
							<span className="text-muted-foreground">Send to AI:</span>{" "}
							<span className="font-medium">{query}</span>
						</button>
					)}
					{categories.map((category) => (
						<div key={category}>
							<p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								{category}
							</p>
							{filtered
								.filter((c) => c.category === category)
								.map((cmd) => {
									const globalIdx = filtered.indexOf(cmd);
									return (
										<button
											key={cmd.id}
											onClick={() => execute(cmd)}
											className={`w-full rounded-md px-3 py-2 text-left text-sm ${
												globalIdx === selectedIndex
													? "bg-accent text-accent-foreground"
													: "hover:bg-accent/50"
											}`}
										>
											{cmd.label}
										</button>
									);
								})}
						</div>
					))}
				</div>

				{/* Footer */}
				<div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
					<span>
						<kbd className="rounded border bg-muted px-1 py-0.5">&#8593;&#8595;</kbd> Navigate{" "}
						<kbd className="rounded border bg-muted px-1 py-0.5">&#9166;</kbd> Execute
					</span>
					<span>
						<kbd className="rounded border bg-muted px-1 py-0.5">&#8984;K</kbd> Toggle
					</span>
				</div>
			</div>
		</div>
	);
}
