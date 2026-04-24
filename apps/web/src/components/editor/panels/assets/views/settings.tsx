"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	CUSTOM_CANVAS_MAX,
	CUSTOM_CANVAS_MIN,
	FPS_PRESETS,
} from "@/constants/project-constants";
import { useEditor } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { dimensionToAspectRatio } from "@/utils/geometry";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/editor/panels/properties/section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { computeReframeScale, type ReframeMode } from "@/lib/reframe";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { TCanvasPreset } from "@/types/project";

const ORIGINAL_PRESET_VALUE = "original";
const CUSTOM_PRESET_VALUE = "custom";

function findPresetIndex({
	presets,
	width,
	height,
}: {
	presets: TCanvasPreset[];
	width: number;
	height: number;
}) {
	return presets.findIndex((p) => p.width === width && p.height === height);
}

export function SettingsView() {
	return (
		<PanelView contentClassName="px-0" hideHeader>
			<div className="flex flex-col">
				<Section showTopBorder={false}>
					<SectionContent>
						<ProjectInfoContent />
					</SectionContent>
				</Section>
				<Popover>
					<Section className="cursor-pointer">
						<PopoverTrigger asChild>
							<div>
								<SectionHeader
									trailing={<div className="size-4 rounded-sm bg-red-500" />}
								>
									<SectionTitle>Background</SectionTitle>
								</SectionHeader>
							</div>
						</PopoverTrigger>
					</Section>
					<PopoverContent>
						<div className="size-4 rounded-sm bg-red-500" />
					</PopoverContent>
				</Popover>
			</div>
		</PanelView>
	);
}

function ProjectInfoContent() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { canvasPresets } = useEditorStore();

	const currentCanvasSize = activeProject.settings.canvasSize;
	const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;
	const presetIndex = findPresetIndex({
		presets: canvasPresets,
		width: currentCanvasSize.width,
		height: currentCanvasSize.height,
	});
	const selectedPresetValue =
		presetIndex !== -1 ? presetIndex.toString() : CUSTOM_PRESET_VALUE;

	const groupedPresets = groupByPlatform(canvasPresets);

	const handleAspectRatioChange = ({ value }: { value: string }) => {
		if (value === ORIGINAL_PRESET_VALUE) {
			const canvasSize = originalCanvasSize ?? currentCanvasSize;
			editor.project.updateSettings({ settings: { canvasSize } });
			return;
		}
		if (value === CUSTOM_PRESET_VALUE) {
			return;
		}
		const index = parseInt(value, 10);
		const preset = canvasPresets[index];
		if (preset) {
			editor.project.updateSettings({
				settings: {
					canvasSize: { width: preset.width, height: preset.height },
				},
			});
		}
	};

	const handleFpsChange = ({ value }: { value: string }) => {
		const fps = parseFloat(value);
		editor.project.updateSettings({ settings: { fps } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Name</Label>
				<span className="leading-none text-sm">
					{activeProject.metadata.name}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Aspect ratio</Label>
				<Select
					value={selectedPresetValue}
					onValueChange={(value) => handleAspectRatioChange({ value })}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select an aspect ratio" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ORIGINAL_PRESET_VALUE}>Original</SelectItem>
						<SelectItem value={CUSTOM_PRESET_VALUE}>
							Custom ({currentCanvasSize.width}×{currentCanvasSize.height})
						</SelectItem>
						{Object.entries(groupedPresets).map(([platform, items]) => (
							<SelectGroup key={platform}>
								<SelectLabel>{platform}</SelectLabel>
								{items.map(({ preset, index }) => {
									const ratio = dimensionToAspectRatio({
										width: preset.width,
										height: preset.height,
									});
									return (
										<SelectItem key={index} value={index.toString()}>
											{preset.label} — {preset.width}×{preset.height} ({ratio})
										</SelectItem>
									);
								})}
							</SelectGroup>
						))}
					</SelectContent>
				</Select>
			</div>
			<CustomCanvasSize
				width={currentCanvasSize.width}
				height={currentCanvasSize.height}
				onApply={({ width, height }) =>
					editor.project.updateSettings({
						settings: { canvasSize: { width, height } },
					})
				}
			/>
			<SmartReframeSection />
			<div className="flex flex-col gap-2">
				<Label>Frame rate</Label>
				<Select
					value={activeProject.settings.fps.toString()}
					onValueChange={(value) => handleFpsChange({ value })}
				>
					<SelectTrigger className="w-fit">
						<SelectValue placeholder="Select a frame rate" />
					</SelectTrigger>
					<SelectContent>
						{FPS_PRESETS.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								{preset.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

function groupByPlatform(presets: TCanvasPreset[]) {
	const groups: Record<string, Array<{ preset: TCanvasPreset; index: number }>> = {};
	presets.forEach((preset, index) => {
		if (!groups[preset.platform]) groups[preset.platform] = [];
		groups[preset.platform].push({ preset, index });
	});
	return groups;
}

function SmartReframeSection() {
	const editor = useEditor();

	const apply = ({ mode }: { mode: ReframeMode }) => {
		const activeProject = editor.project.getActive();
		const canvas = activeProject.settings.canvasSize;
		const assets = editor.media.getAssets();
		const tracks = editor.timeline.getTracks();

		const updates: Array<{
			trackId: string;
			elementId: string;
			updates: { transform: { scale: number; position: { x: number; y: number }; rotate: number } };
		}> = [];

		for (const track of tracks) {
			if (track.type !== "video") continue;
			for (const element of track.elements) {
				if (element.type !== "video" && element.type !== "image") continue;
				const asset = assets.find((a) => a.id === element.mediaId);
				if (!asset || !asset.width || !asset.height) continue;
				const scale = computeReframeScale({
					mode,
					canvas,
					source: { width: asset.width, height: asset.height },
				});
				updates.push({
					trackId: track.id,
					elementId: element.id,
					updates: {
						transform: {
							scale,
							position: { x: 0, y: 0 },
							rotate: element.transform.rotate,
						},
					},
				});
			}
		}

		if (updates.length === 0) {
			toast.info("No video or image clips to reframe");
			return;
		}
		editor.timeline.updateElements({ updates });
		toast.success(
			`Reframed ${updates.length} clip${updates.length === 1 ? "" : "s"} (${mode})`,
		);
	};

	return (
		<div className="flex flex-col gap-2">
			<Label>Smart reframe</Label>
			<div className="flex items-center gap-2">
				<Button
					size="sm"
					variant="outline"
					onClick={() => apply({ mode: "cover" })}
				>
					Fill canvas
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => apply({ mode: "contain" })}
				>
					Fit canvas
				</Button>
			</div>
			<span className="text-muted-foreground text-xs">
				Auto-resize all clips to match the current aspect ratio. Fill crops to cover; Fit letterboxes.
			</span>
		</div>
	);
}

function CustomCanvasSize({
	width,
	height,
	onApply,
}: {
	width: number;
	height: number;
	onApply: (size: { width: number; height: number }) => void;
}) {
	const [draftWidth, setDraftWidth] = useState(width.toString());
	const [draftHeight, setDraftHeight] = useState(height.toString());

	const applyIfValid = () => {
		const parsedWidth = parseInt(draftWidth, 10);
		const parsedHeight = parseInt(draftHeight, 10);
		if (
			Number.isFinite(parsedWidth) &&
			Number.isFinite(parsedHeight) &&
			parsedWidth >= CUSTOM_CANVAS_MIN &&
			parsedHeight >= CUSTOM_CANVAS_MIN &&
			parsedWidth <= CUSTOM_CANVAS_MAX &&
			parsedHeight <= CUSTOM_CANVAS_MAX
		) {
			onApply({ width: parsedWidth, height: parsedHeight });
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Label>Custom size (W × H)</Label>
			<div className="flex items-center gap-2">
				<Input
					type="number"
					value={draftWidth}
					onChange={(event) => setDraftWidth(event.target.value)}
					min={CUSTOM_CANVAS_MIN}
					max={CUSTOM_CANVAS_MAX}
					className="w-24"
				/>
				<span className="text-muted-foreground text-sm">×</span>
				<Input
					type="number"
					value={draftHeight}
					onChange={(event) => setDraftHeight(event.target.value)}
					min={CUSTOM_CANVAS_MIN}
					max={CUSTOM_CANVAS_MAX}
					className="w-24"
				/>
				<Button size="sm" variant="outline" onClick={applyIfValid}>
					Apply
				</Button>
			</div>
		</div>
	);
}
