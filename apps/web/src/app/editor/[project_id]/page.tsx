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
		<div className="flex h-full flex-col items-center pt-3">
			<button
				onClick={onOpen}
				className="rounded-md p-2 hover:bg-muted transition-colors"
				title="AI Assistant (Ctrl+K)"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>
			</button>
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
					className="shrink-0 border-r bg-background transition-all duration-200"
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
