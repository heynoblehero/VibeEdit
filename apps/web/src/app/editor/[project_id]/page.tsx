"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/editor/panels/chat";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";
import { usePasteMedia } from "@/hooks/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
					<EditorHeader />
					<div className="min-h-0 min-w-0 flex-1">
						<EditorLayout />
					</div>
					<Onboarding />
					<MigrationDialog />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

function CollapsedSidebar({ onOpen }: { onOpen: () => void }) {
	return (
		<div className="flex h-full w-full flex-col items-center bg-stone-50 dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800 pt-3">
			<button
				onClick={onOpen}
				className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
				title="AI Assistant (Ctrl+K)"
			>
				<span className="text-xs font-bold text-amber-700 dark:text-amber-300">AI</span>
			</button>
			<span className="text-[10px] text-stone-400 mt-1.5">⌘K</span>
		</div>
	);
}

function EditorLayout() {
	usePasteMedia();

	const [chatOpen, setChatOpen] = useState(false);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "k") {
				e.preventDefault();
				setChatOpen((prev) => !prev);
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, []);

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-1 overflow-hidden">
				{/* Collapsible chat sidebar */}
				<div
					className="shrink-0 transition-all duration-200 overflow-hidden"
					style={{ width: chatOpen ? 380 : 48 }}
				>
					{chatOpen ? (
						<ChatPanel onClose={() => setChatOpen(false)} />
					) : (
						<CollapsedSidebar onOpen={() => setChatOpen(true)} />
					)}
				</div>
				{/* Right side: preview + timeline */}
				<div className="flex-1 flex flex-col overflow-hidden">
					<div className="flex-1 min-h-0">
						<PreviewPanel />
					</div>
					<div className="h-[280px] shrink-0 border-t">
						<Timeline />
					</div>
				</div>
			</div>
		</div>
	);
}
