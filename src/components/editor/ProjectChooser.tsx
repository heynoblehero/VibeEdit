"use client";

import { ChevronDown, Monitor, Settings2, Smartphone, Sparkles } from "lucide-react";
import { useState } from "react";
import { ASPECT_OPTIONS, type AspectOption, setDefaultAspect } from "@/lib/aspect-prefs";
import { useProjectStore } from "@/store/project-store";

/**
 * Landing screen rendered by Preview when the project has no scenes.
 * Two big tiles let the user pick the most common formats (vertical
 * Shorts/Reels/TikTok or horizontal YouTube). A "Custom size" expansion
 * reveals the rest of the ASPECT_OPTIONS for square / 4:5 / cinematic.
 *
 * A project pins to a single aspect — every scene shares the project
 * canvas. Users can resize later via the topbar AspectSwitcher; that
 * just rescales the project canvas, doesn't fork per-scene aspects.
 */

const VERTICAL = ASPECT_OPTIONS.find((o) => o.id === "9:16")!;
const HORIZONTAL = ASPECT_OPTIONS.find((o) => o.id === "16:9")!;

export function ProjectChooser() {
	const project = useProjectStore((s) => s.project);
	const setDimensions = useProjectStore((s) => s.setDimensions);
	const addScene = useProjectStore((s) => s.addScene);
	const [showMore, setShowMore] = useState(false);

	const start = async (opt: AspectOption) => {
		const { createId, defaultPlaceholderTextItem, DEFAULT_BG } = await import(
			"@/lib/scene-schema"
		);
		setDimensions(opt.width, opt.height);
		const portrait = opt.height > opt.width;
		addScene({
			id: createId(),
			type: "text_only",
			duration: 2,
			textItems: [
				defaultPlaceholderTextItem({
					content: "Tap to edit · drag to move",
					fontSize: portrait ? 96 : 72,
					y: portrait ? 500 : 380,
				}),
			],
			transition: "beat_flash",
			background: { ...DEFAULT_BG },
		});
		setDefaultAspect(opt);
	};

	return (
		<div className="flex items-center justify-center h-full w-full p-6 sm:p-10">
			<div className="w-full max-w-5xl flex flex-col gap-8">
				<header className="text-center space-y-2">
					<div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
						<Sparkles className="h-4 w-4" />
						New project
					</div>
					<h1 className="text-3xl sm:text-4xl font-bold text-white">
						What are you making?
					</h1>
					<p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
						Pick a canvas. This sets the size for every scene in the project — you can
						resize the whole project later from the top bar.
					</p>
				</header>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
					<ChooserTile
						title="Shorts / Reels / TikTok"
						subtitle="Vertical · 9:16 · 1080×1920"
						hint="The default for most short-form video"
						orientation="portrait"
						onClick={() => start(VERTICAL)}
						current={project.width === VERTICAL.width && project.height === VERTICAL.height}
					/>
					<ChooserTile
						title="YouTube / Long-form"
						subtitle="Landscape · 16:9 · 1920×1080"
						hint="Talking head, tutorials, gameplay, vlogs"
						orientation="landscape"
						onClick={() => start(HORIZONTAL)}
						current={
							project.width === HORIZONTAL.width && project.height === HORIZONTAL.height
						}
					/>
				</div>

				<div className="rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden">
					<button
						type="button"
						onClick={() => setShowMore((v) => !v)}
						className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-neutral-900/60 transition-colors"
					>
						<div className="flex items-center gap-2">
							<Settings2 className="h-4 w-4 text-neutral-400" />
							<div>
								<div className="text-sm font-semibold text-neutral-200">Custom size</div>
								<div className="text-xs text-neutral-500">
									Square · 4:5 vertical · 21:9 cinematic
								</div>
							</div>
						</div>
						<ChevronDown
							className={`h-4 w-4 text-neutral-500 transition-transform ${showMore ? "rotate-180" : ""}`}
						/>
					</button>
					{showMore && (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4 pt-0 border-t border-neutral-800/60">
							{ASPECT_OPTIONS.filter((o) => o.id !== "9:16" && o.id !== "16:9").map(
								(opt) => (
									<button
										key={opt.id}
										type="button"
										onClick={() => start(opt)}
										className="flex items-center gap-3 p-3 rounded-lg border border-neutral-800 hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors group"
									>
										<MiniGlyph w={opt.width} h={opt.height} />
										<div className="flex-1 min-w-0 text-left">
											<div className="text-sm font-semibold text-neutral-200 group-hover:text-emerald-200">
												{opt.label}
											</div>
											<div className="text-[11px] text-neutral-500 truncate">
												{opt.description}
											</div>
											<div className="text-[10px] font-mono text-neutral-600 mt-0.5">
												{opt.width}×{opt.height}
											</div>
										</div>
									</button>
								),
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function ChooserTile({
	title,
	subtitle,
	hint,
	orientation,
	onClick,
	current,
}: {
	title: string;
	subtitle: string;
	hint: string;
	orientation: "portrait" | "landscape";
	onClick: () => void;
	current: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`relative flex flex-col items-stretch rounded-2xl border-2 bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 sm:p-6 text-left transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-500/10 ${
				current
					? "border-emerald-500 ring-2 ring-emerald-500/30"
					: "border-neutral-800 hover:border-emerald-500/60"
			}`}
		>
			<div className="flex items-center justify-center h-32 sm:h-44 mb-4">
				<DeviceGlyph orientation={orientation} active={current} />
			</div>
			<div className="space-y-1.5">
				<div className="flex items-center gap-2">
					{orientation === "portrait" ? (
						<Smartphone className="h-4 w-4 text-emerald-400" />
					) : (
						<Monitor className="h-4 w-4 text-emerald-400" />
					)}
					<h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
					{current && (
						<span className="ml-auto text-[10px] font-semibold text-emerald-300 uppercase tracking-wider bg-emerald-500/15 px-1.5 py-0.5 rounded">
							Current
						</span>
					)}
				</div>
				<div className="text-xs text-neutral-400 font-mono">{subtitle}</div>
				<div className="text-xs text-neutral-500">{hint}</div>
			</div>
		</button>
	);
}

function DeviceGlyph({
	orientation,
	active,
}: {
	orientation: "portrait" | "landscape";
	active: boolean;
}) {
	const w = orientation === "portrait" ? 90 : 160;
	const h = orientation === "portrait" ? 160 : 90;
	const stroke = active ? "rgb(16 185 129)" : "rgb(82 82 82)";
	const fill = active ? "rgba(16, 185, 129, 0.08)" : "rgb(23 23 23)";
	return (
		<svg
			width={w + 20}
			height={h + 20}
			viewBox={`0 0 ${w + 20} ${h + 20}`}
			className="drop-shadow-[0_4px_24px_rgba(16,185,129,0.15)]"
		>
			<rect
				x={6}
				y={6}
				width={w + 8}
				height={h + 8}
				rx={orientation === "portrait" ? 12 : 8}
				fill={fill}
				stroke={stroke}
				strokeWidth={2}
			/>
			<rect
				x={14}
				y={14}
				width={w - 8}
				height={h - 8}
				rx={4}
				fill="rgb(10 10 10)"
				stroke={active ? "rgb(16 185 129 / 0.4)" : "rgb(38 38 38)"}
			/>
			{orientation === "portrait" && (
				<rect x={(w + 20) / 2 - 12} y={11} width={24} height={3} rx={1.5} fill="rgb(38 38 38)" />
			)}
			{orientation === "landscape" && (
				<rect
					x={(w + 20) / 2 - 8}
					y={h + 12}
					width={16}
					height={4}
					rx={1}
					fill="rgb(38 38 38)"
				/>
			)}
		</svg>
	);
}

function MiniGlyph({ w, h }: { w: number; h: number }) {
	const ratio = w / h;
	const size = 32;
	const boxW = ratio >= 1 ? size : Math.max(12, Math.round(size * ratio));
	const boxH = ratio >= 1 ? Math.max(12, Math.round(size / ratio)) : size;
	return (
		<div
			className="shrink-0 rounded border border-neutral-600 bg-neutral-800"
			style={{ width: boxW, height: boxH }}
		/>
	);
}
