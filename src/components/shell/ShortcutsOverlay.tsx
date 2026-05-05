"use client";

import { Keyboard, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Kbd, modKey } from "@/components/ui/Kbd";

interface Shortcut {
	keys: string[];
	label: string;
}

interface Section {
	title: string;
	shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
	{
		title: "Navigation",
		shortcuts: [
			{ keys: ["⌘", "K"], label: "Command palette — jump anywhere" },
			{ keys: ["?"], label: "Show this shortcuts overlay" },
			{ keys: ["g", "v"], label: "Switch to Video tab" },
			{ keys: ["g", "a"], label: "Switch to Audio tab" },
			{ keys: ["g", "n"], label: "Switch to Animate tab" },
			{ keys: ["g", "d"], label: "Go to dashboard" },
		],
	},
	{
		title: "Playback",
		shortcuts: [
			{ keys: ["Space"], label: "Play / pause" },
			{ keys: ["←"], label: "Step back 1 frame" },
			{ keys: ["→"], label: "Step forward 1 frame" },
			{ keys: ["⇧", "←"], label: "Step back 10 frames" },
			{ keys: ["⇧", "→"], label: "Step forward 10 frames" },
			{ keys: ["["], label: "Set loop start at playhead" },
			{ keys: ["]"], label: "Set loop end at playhead" },
		],
	},
	{
		title: "Editing",
		shortcuts: [
			{ keys: ["⌘", "Z"], label: "Undo" },
			{ keys: ["⌘", "⇧", "Z"], label: "Redo" },
			{ keys: ["⌘", "C"], label: "Copy selection" },
			{ keys: ["⌘", "V"], label: "Paste" },
			{ keys: ["⌫"], label: "Delete selection" },
			{ keys: ["⌘", "D"], label: "Duplicate scene / clip" },
			{ keys: ["C"], label: "Cut tool — split scene at playhead" },
			{ keys: ["V"], label: "Selection tool" },
		],
	},
	{
		title: "View",
		shortcuts: [
			{ keys: ["Z"], label: "Toggle zen mode (hide chrome)" },
			{ keys: ["⌘", "+"], label: "Zoom in timeline" },
			{ keys: ["⌘", "-"], label: "Zoom out timeline" },
			{ keys: ["⌘", "0"], label: "Reset timeline zoom" },
		],
	},
];

/**
 * Global "?" overlay listing every keyboard shortcut. Lives next to
 * the command palette in the layout shell so every screen can hit
 * it. Press `?` to toggle, Esc to close.
 */
export function ShortcutsOverlay() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Ignore when typing in an input
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
				e.preventDefault();
				setOpen((v) => !v);
			} else if (e.key === "Escape" && open) {
				setOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	if (!open) return null;

	const mod = modKey();

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 motion-fade"
			onClick={() => setOpen(false)}
			onKeyDown={() => {}}
			role="presentation"
		>
			<div
				className="w-full max-w-2xl max-h-[80vh] rounded-lg bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col motion-pop"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Keyboard shortcuts"
			>
				<div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
					<div className="flex items-center gap-2">
						<Keyboard className="h-4 w-4 text-neutral-300" />
						<span className="text-[13px] font-semibold text-neutral-100">
							Keyboard shortcuts
						</span>
					</div>
					<IconButton
						icon={<X className="h-3.5 w-3.5" />}
						label="Close"
						onClick={() => setOpen(false)}
					/>
				</div>
				<div className="flex-1 overflow-y-auto p-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
						{SECTIONS.map((section) => (
							<div key={section.title} className="space-y-2">
								<div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
									{section.title}
								</div>
								<div className="space-y-1.5">
									{section.shortcuts.map((sc) => (
										<div
											key={sc.label}
											className="flex items-center justify-between gap-3"
										>
											<span className="text-[12px] text-neutral-300">
												{sc.label}
											</span>
											<Kbd keys={sc.keys.map((k) => (k === "⌘" ? mod : k))} />
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="px-4 py-2 border-t border-neutral-800 text-[10px] text-neutral-500">
					Press <Kbd keys={["?"]} /> any time to toggle. <Kbd keys={["Esc"]} /> to close.
				</div>
			</div>
		</div>
	);
}
