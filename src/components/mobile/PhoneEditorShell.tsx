"use client";

import { ChevronLeft, Film, ListVideo, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PhoneEditTab } from "@/components/mobile/PhoneEditTab";
import { PhoneRenderTab } from "@/components/mobile/PhoneRenderTab";
import { PhoneScenesTab } from "@/components/mobile/PhoneScenesTab";
import { RenderButton } from "@/components/editor/RenderButton";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { haptics } from "@/lib/haptics";
import { useProjectStore } from "@/store/project-store";

export type PhoneTab = "scenes" | "edit" | "render";

const HISTORY_SENTINEL = "vibeedit-phone-tab";

/**
 * Phone-first editor shell. Renders below 720px from ProjectShell.
 *
 * Layout:
 *  ┌─────────────────────────────┐  ← --safe-top
 *  │ ←  Project name        ▶ R  │   app bar
 *  ├─────────────────────────────┤
 *  │                             │
 *  │      active tab body        │
 *  │                             │
 *  ├─────────────────────────────┤
 *  │  Scenes  ·  Edit  ·  Render │   tab bar
 *  └─────────────────────────────┘  ← --safe-bottom
 *
 * Tab transitions push a `history.state` sentinel so Android's hardware
 * back button (and the Capacitor app plugin in Phase 3) can pop the
 * tab stack instead of exiting the app on the first press. The same
 * `isPoppingRef` trick MobileDrawer uses prevents the popstate handler
 * from re-pushing on its own pop (infinite loop).
 */
export function PhoneEditorShell() {
	const project = useProjectStore((s) => s.project);
	const [tab, setTab] = useState<PhoneTab>("scenes");
	const isPoppingRef = useRef(false);

	const switchTab = (next: PhoneTab) => {
		if (next === tab) return;
		haptics.light();
		setTab(next);
		try {
			window.history.pushState({ [HISTORY_SENTINEL]: next }, "");
		} catch {
			// pushState can throw in sandboxed contexts; non-fatal.
		}
	};

	useEffect(() => {
		const onPop = (event: PopStateEvent) => {
			isPoppingRef.current = true;
			const next = event.state?.[HISTORY_SENTINEL] as PhoneTab | undefined;
			// If the popped state is one of ours, honour it. Otherwise
			// the user popped past our sentinel — let the navigation
			// proceed (back to /dashboard or wherever).
			if (next === "scenes" || next === "edit" || next === "render") {
				setTab(next);
			}
			// Reset the guard on the next tick so future user-driven
			// pushes can register.
			queueMicrotask(() => {
				isPoppingRef.current = false;
			});
		};
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	return (
		<div
			className="flex flex-col h-screen bg-neutral-950 text-neutral-100"
			style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
		>
			{/* App bar */}
			<header className="shrink-0 flex items-center justify-between gap-2 px-2 h-12 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
				<Link
					href="/dashboard"
					className="flex items-center gap-1 text-neutral-300 hover:text-white px-1 -ml-1 h-9 min-w-9 justify-center"
					title="Back to projects"
					aria-label="Back to projects"
				>
					<ChevronLeft className="h-5 w-5" />
				</Link>
				<div className="flex-1 min-w-0 flex items-center justify-center gap-1.5">
					<Film className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
					<span className="text-[13px] font-medium truncate max-w-[180px]">
						{project.name || "Untitled"}
					</span>
					<SaveIndicator />
				</div>
				<div className="flex items-center">
					<RenderButton />
				</div>
			</header>

			{/* Tab body */}
			<main className="flex-1 min-h-0 overflow-hidden relative">
				<div
					key={tab}
					className="absolute inset-0 motion-fade overflow-hidden flex flex-col"
				>
					{tab === "scenes" ? (
						<PhoneScenesTab onOpenEdit={() => switchTab("edit")} />
					) : tab === "edit" ? (
						<PhoneEditTab />
					) : (
						<PhoneRenderTab />
					)}
				</div>
			</main>

			{/* Tab bar */}
			<nav className="shrink-0 grid grid-cols-3 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur h-14">
				<TabButton
					active={tab === "scenes"}
					onClick={() => switchTab("scenes")}
					icon={<Film className="h-5 w-5" />}
					label="Scenes"
				/>
				<TabButton
					active={tab === "edit"}
					onClick={() => switchTab("edit")}
					icon={<Pencil className="h-5 w-5" />}
					label="Edit"
				/>
				<TabButton
					active={tab === "render"}
					onClick={() => switchTab("render")}
					icon={<ListVideo className="h-5 w-5" />}
					label="Render"
				/>
			</nav>
		</div>
	);
}

interface TabButtonProps {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
				active
					? "text-emerald-300"
					: "text-neutral-500 hover:text-neutral-200"
			}`}
		>
			<span className="relative">
				{icon}
				{active && (
					<Sparkles className="absolute -top-1 -right-2 h-2.5 w-2.5 text-emerald-400/60" />
				)}
			</span>
			<span className="text-[10px] font-medium tracking-wide">{label}</span>
		</button>
	);
}
