"use client";

import { useParams } from "next/navigation";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
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

function EditorLayout() {
	usePasteMedia();

	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="size-full"
		>
			{/* LEFT: AI Chat Panel */}
			<ResizablePanel
				defaultSize={35}
				minSize={25}
				maxSize={50}
				className="min-w-0"
			>
				<ChatPanel />
			</ResizablePanel>

			<ResizableHandle withHandle />

			{/* RIGHT: Preview + Timeline */}
			<ResizablePanel defaultSize={65} className="min-h-0 min-w-0">
				<ResizablePanelGroup
					direction="vertical"
					className="size-full"
				>
					{/* Preview */}
					<ResizablePanel
						defaultSize={65}
						minSize={30}
						className="min-h-0"
					>
						<PreviewPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Timeline (collapsible) */}
					<ResizablePanel
						defaultSize={35}
						minSize={15}
						collapsible
						className="min-h-0"
					>
						<Timeline />
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
