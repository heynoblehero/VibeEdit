"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/hooks/use-editor";
import { useFileUpload } from "@/hooks/use-file-upload";
import { processMediaAssets } from "@/lib/media/processing";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";

export function ManualToolsDrawer({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);

	const processFiles = async ({ files }: { files: FileList }) => {
		if (!files || files.length === 0) return;
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		setIsProcessing(true);
		setProgress(0);
		try {
			const processedAssets = await processMediaAssets({
				files,
				onProgress: (p: { progress: number }) => setProgress(p.progress),
			});
			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
			toast.success(`Imported ${processedAssets.length} file(s)`);
		} catch (error) {
			console.error("Error processing files:", error);
			toast.error("Failed to process files");
		} finally {
			setIsProcessing(false);
			setProgress(0);
		}
	};

	const { isDragOver, dragProps, openFilePicker, fileInputProps } =
		useFileUpload({
			accept: "image/*,video/*,audio/*",
			multiple: true,
			onFilesSelected: (files) => processFiles({ files }),
		});

	const handleAddText = () => {
		const element = buildElementFromMedia({
			mediaId: undefined as unknown as string,
			mediaType: "text" as "video",
			name: "Text",
			duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			startTime: 0,
		});
		editor.timeline.insertElement({
			element: {
				...element,
				type: "text",
				content: "Your text here",
			},
			placement: { mode: "auto" },
		});
		toast.success("Text element added");
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="left" className="w-80 sm:max-w-sm">
				<SheetHeader>
					<SheetTitle>Manual Tools</SheetTitle>
					<SheetDescription>
						Quick access to basic editing tools. Use the AI chat for
						advanced editing.
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-4">
					{/* Media Upload */}
					<div>
						<h3 className="mb-2 text-sm font-medium">
							Import Media
						</h3>
						<input {...fileInputProps} />
						<div
							{...dragProps}
							onClick={openFilePicker}
							className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
								isDragOver ? "border-primary bg-primary/5" : ""
							}`}
						>
							{isProcessing ? (
								<>
									<p className="text-muted-foreground text-sm">
										Processing...
									</p>
									<div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
										<div
											className="bg-primary h-full rounded-full transition-all"
											style={{
												width: `${progress * 100}%`,
											}}
										/>
									</div>
								</>
							) : (
								<>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-muted-foreground mb-2"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="17,8 12,3 7,8" />
										<line
											x1="12"
											y1="3"
											x2="12"
											y2="15"
										/>
									</svg>
									<p className="text-muted-foreground text-sm">
										Drop files here or click to browse
									</p>
									<p className="text-muted-foreground/70 mt-1 text-xs">
										Video, image, and audio files
									</p>
								</>
							)}
						</div>
					</div>

					{/* Add Text */}
					<div>
						<h3 className="mb-2 text-sm font-medium">Add Text</h3>
						<Button
							variant="outline"
							className="w-full"
							onClick={handleAddText}
						>
							Add Text Element
						</Button>
					</div>

					{/* Hint */}
					<div className="bg-muted/50 rounded-lg p-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							For advanced editing -- effects, keyframes,
							transforms, splitting, and more -- use the AI chat.
							Just describe what you want and the AI will handle
							it.
						</p>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
