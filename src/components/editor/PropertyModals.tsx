"use client";

import { Activity, Palette, Pause, Play, Zap } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { evaluateKeyframes } from "@/lib/anim";
import type { Keyframe, KeyframeProperty, Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";
import { EasingGraph } from "./EasingGraph";
import { ModalTrigger, PropertyModal } from "./PropertyModal";


/* ─── Mirror of the renderer's grade + key math (GradientBg.tsx). ───
 * Kept as a small inline copy so this preview stays a pure client
 * component without dragging Remotion into the bundle. If the renderer
 * ever changes these formulas, update them here too. */

function gradeFilter(grade: NonNullable<Scene["background"]["colorGrade"]>): string {
	switch (grade) {
		case "warm":
			return "sepia(0.25) saturate(1.15) hue-rotate(-8deg) brightness(1.04)";
		case "cool":
			return "hue-rotate(180deg) saturate(0.85) brightness(0.96) contrast(1.05)";
		case "punchy":
			return "saturate(1.35) contrast(1.18) brightness(1.04)";
		case "bw":
			return "grayscale(1) contrast(1.12) brightness(1.02)";
		case "neutral":
			return "none";
	}
}

function chromaKeyMatrix(color: string): [number, number, number] {
	const r = parseInt(color.slice(1, 3), 16) / 255;
	const g = parseInt(color.slice(3, 5), 16) / 255;
	const b = parseInt(color.slice(5, 7), 16) / 255;
	if (g >= r && g >= b) return [-1, 2, -1];
	if (b >= r && b >= g) return [-1, -1, 2];
	return [2, -1, -1];
}

function chromaTable(softness: number): string {
	const s = Math.max(0, Math.min(1, softness));
	const steps = Math.max(2, Math.round(2 + s * 6));
	const half = Math.floor(steps / 2);
	const vals: number[] = [];
	for (let i = 0; i < half; i++) vals.push(1);
	for (let i = half; i < steps; i++) {
		if (s === 0) vals.push(0);
		else vals.push(Math.max(0, 1 - (i - half + 1) / (steps - half)));
	}
	return vals.join(" ");
}

function lumaTable(threshold: number, softness: number, invert: boolean): string {
	const t = Math.max(0, Math.min(1, threshold));
	const s = Math.max(0, Math.min(0.5, softness));
	const N = 16;
	const vals: number[] = [];
	for (let i = 0; i < N; i++) {
		const x = i / (N - 1);
		let alpha: number;
		if (s === 0) alpha = x >= t ? 1 : 0;
		else {
			const lo = t - s;
			const hi = t + s;
			if (x <= lo) alpha = 0;
			else if (x >= hi) alpha = 1;
			else alpha = (x - lo) / (hi - lo);
		}
		if (invert) alpha = 1 - alpha;
		vals.push(alpha);
	}
	return vals.map((v) => v.toFixed(3)).join(" ");
}

function LookPreview({ scene }: { scene: Scene }) {
	const bg = scene.background;
	// useId() can include colons (":r0:") which break url(#…) refs in some
	// browsers/CSS parsers. Strip non-alphanumerics for a safe SVG id.
	const idBase = useId().replace(/[^a-zA-Z0-9]/g, "");
	const chromaId = bg.chromaKey ? `chroma-${idBase}` : null;
	const lumaId = bg.lumaKey ? `luma-${idBase}` : null;
	const colorFilter = [
		gradeFilter(bg.colorGrade ?? "neutral"),
		(bg.brightness ?? 1) !== 1 ? `brightness(${bg.brightness})` : null,
		(bg.contrast ?? 1) !== 1 ? `contrast(${bg.contrast})` : null,
		(bg.saturation ?? 1) !== 1 ? `saturate(${bg.saturation})` : null,
		(bg.temperature ?? 0) !== 0
			? `hue-rotate(${((bg.temperature ?? 0) * 20).toFixed(1)}deg)`
			: null,
		(bg.blur ?? 0) > 0 ? `blur(${bg.blur}px)` : null,
		chromaId ? `url(#${chromaId})` : null,
		lumaId ? `url(#${lumaId})` : null,
	]
		.filter(Boolean)
		.join(" ");

	const orientationTransform = [
		bg.rotate ? `rotate(${bg.rotate}deg)` : null,
		bg.flipH ? "scaleX(-1)" : null,
		bg.flipV ? "scaleY(-1)" : null,
	]
		.filter(Boolean)
		.join(" ") || undefined;

	const vignette = bg.vignette ?? 0.5;

	return (
		<div className="relative w-full overflow-hidden rounded-md border border-neutral-800 bg-black aspect-video">
			{/* SVG defs for chroma/luma when active. */}
			{(bg.chromaKey || bg.lumaKey) && (
				<svg width="0" height="0" className="absolute pointer-events-none" aria-hidden>
					<defs>
						{bg.chromaKey && chromaId && (
							<filter id={chromaId} colorInterpolationFilters="sRGB">
								<feColorMatrix
									type="matrix"
									values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${chromaKeyMatrix(bg.chromaKey.color).join(" ")} 0 ${(-Math.max(0, Math.min(1, bg.chromaKey.tolerance))).toFixed(3)}`}
									result="keyed"
								/>
								<feComponentTransfer in="keyed" result="mask">
									<feFuncA type="table" tableValues={chromaTable(bg.chromaKey.softness)} />
								</feComponentTransfer>
								<feComposite operator="in" in="SourceGraphic" in2="mask" />
							</filter>
						)}
						{bg.lumaKey && lumaId && (
							<filter id={lumaId} colorInterpolationFilters="sRGB">
								<feColorMatrix type="luminanceToAlpha" result="lum" />
								<feComponentTransfer in="lum" result="mask">
									<feFuncA
										type="table"
										tableValues={lumaTable(
											bg.lumaKey.threshold,
											bg.lumaKey.softness,
											!!bg.lumaKey.invert,
										)}
									/>
								</feComponentTransfer>
								<feComposite operator="in" in="SourceGraphic" in2="mask" />
							</filter>
						)}
					</defs>
				</svg>
			)}

			{/* Checkerboard so transparency from keying is obvious. */}
			<div
				aria-hidden
				className="absolute inset-0"
				style={{
					backgroundColor: bg.color,
					backgroundImage:
						"linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
					backgroundSize: "16px 16px",
					backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
					opacity: bg.chromaKey || bg.lumaKey ? 1 : 0,
				}}
			/>

			{!bg.imageUrl && !bg.videoUrl && (
				<div className="absolute inset-0" style={{ backgroundColor: bg.color }} />
			)}

			{bg.imageUrl && (
				// biome-ignore lint/a11y/useAltText: decorative live preview
				<img
					src={bg.imageUrl}
					alt=""
					className="absolute inset-0 w-full h-full"
					style={{
						objectFit: "cover",
						filter: colorFilter,
						transform: orientationTransform,
						transformOrigin: "center center",
					}}
				/>
			)}

			{bg.videoUrl && (
				<video
					src={bg.videoUrl}
					autoPlay
					muted
					playsInline
					loop
					className="absolute inset-0 w-full h-full"
					style={{
						objectFit: "cover",
						filter: colorFilter,
						transform: orientationTransform,
						transformOrigin: "center center",
					}}
				/>
			)}

			{/* Vignette overlay — matches renderer's radial darken. */}
			{vignette > 0 && (
				<div
					aria-hidden
					className="absolute inset-0 pointer-events-none"
					style={{
						background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${vignette}) 100%)`,
					}}
				/>
			)}

			<span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider text-white/70 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
				Preview
			</span>
		</div>
	);
}

/**
 * Heavy property sections lifted into focused, animated modals.
 * Trigger row + modal definitions live together so each section is
 * one self-contained import.
 */

interface SectionProps {
	scene: Scene;
	update: (p: Partial<Scene>) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
				{label}
			</label>
			{children}
		</div>
	);
}

function Slider({
	label,
	value,
	min,
	max,
	step,
	onChange,
	format,
	accent = "purple",
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (n: number) => void;
	format?: (n: number) => string;
	accent?: "purple" | "emerald" | "amber" | "cyan" | "sky";
}) {
	const accentClass = {
		purple: "accent-purple-500",
		emerald: "accent-emerald-500",
		amber: "accent-amber-500",
		cyan: "accent-cyan-500",
		sky: "accent-sky-500",
	}[accent];
	return (
		<div className="space-y-1">
			<div className="flex items-baseline justify-between">
				<label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
					{label}
				</label>
				<span className="text-[10px] text-neutral-400 font-mono tabular-nums">
					{format ? format(value) : value.toFixed(2)}
				</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className={`w-full ${accentClass} h-1.5`}
			/>
		</div>
	);
}

/* ─────────────────────── Look & Key (combined) ─────────────────────── */

type LookTab = "grade" | "key";

function hasGrade(bg: Scene["background"]): boolean {
	return (
		(bg.brightness ?? 1) !== 1 ||
		(bg.contrast ?? 1) !== 1 ||
		(bg.saturation ?? 1) !== 1 ||
		(bg.temperature ?? 0) !== 0 ||
		!!bg.colorGrade ||
		!!bg.blur
	);
}

function hasKey(bg: Scene["background"]): boolean {
	return !!bg.chromaKey || !!bg.lumaKey;
}

export function LookTrigger({
	scene,
	onOpen,
}: {
	scene: Scene;
	onOpen: () => void;
}) {
	const grade = hasGrade(scene.background);
	const key = hasKey(scene.background);
	const hint =
		grade && key
			? "Look + key applied"
			: grade
				? "Look applied"
				: key
					? "Key applied"
					: "Color grade · chroma · luma";
	return (
		<ModalTrigger
			onClick={onOpen}
			icon={<Palette className="h-4 w-4" />}
			label="Look & Key"
			hint={hint}
			accent="purple"
		/>
	);
}

export function LookModal({
	open,
	onClose,
	scene,
	update,
}: { open: boolean; onClose: () => void } & SectionProps) {
	const [tab, setTab] = useState<LookTab>("grade");
	const bg = scene.background;
	const setBg = (patch: Partial<Scene["background"]>) =>
		update({ background: { ...bg, ...patch } });

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Look & Key"
			subtitle="Color grade the scene, then knock out colors or brightness ranges."
			accent="purple"
			width="default"
		>
			<LookPreview scene={scene} />

			<div className="flex gap-1 p-0.5 rounded-md bg-neutral-950 border border-neutral-800">
				{(
					[
						["grade", "Color grade", hasGrade(bg)],
						["key", "Keying", hasKey(bg)],
					] as const
				).map(([id, label, dot]) => (
					<button
						key={id}
						type="button"
						onClick={() => setTab(id)}
						className={`flex-1 relative text-[11px] px-2 py-1.5 rounded transition-colors ${
							tab === id
								? "bg-purple-500/15 text-purple-200"
								: "text-neutral-500 hover:text-white"
						}`}
					>
						{label}
						{dot && (
							<span
								aria-hidden
								className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-purple-400"
							/>
						)}
					</button>
				))}
			</div>

			{tab === "grade" && <ColorGradeBody scene={scene} setBg={setBg} />}
			{tab === "key" && <KeyingBody scene={scene} update={update} />}
		</PropertyModal>
	);
}

function ColorGradeBody({
	scene,
	setBg,
}: {
	scene: Scene;
	setBg: (patch: Partial<Scene["background"]>) => void;
}) {
	const bg = scene.background;

	const reset = () =>
		setBg({
			brightness: 1,
			contrast: 1,
			saturation: 1,
			temperature: 0,
			blur: 0,
			colorGrade: undefined,
		});

	const applyToAll = () => {
		const bundle = {
			colorGrade: bg.colorGrade,
			brightness: bg.brightness,
			contrast: bg.contrast,
			saturation: bg.saturation,
			temperature: bg.temperature,
			blur: bg.blur,
			vignette: bg.vignette,
		};
		const all = useProjectStore.getState().project.scenes;
		for (const sc of all) {
			if (sc.id === scene.id) continue;
			useProjectStore.getState().updateScene(sc.id, {
				background: { ...sc.background, ...bundle },
			});
		}
		toast.success(`Look applied to ${all.length - 1} scene${all.length - 1 === 1 ? "" : "s"}`);
	};

	const surprise = () => {
		const looks = [
			{ colorGrade: "warm" as const, contrast: 1.12, saturation: 1.08, brightness: 0.98 },
			{ colorGrade: "punchy" as const, contrast: 1.25, saturation: 1.2 },
			{ colorGrade: "bw" as const, contrast: 1.3, brightness: 0.92 },
			{ blur: 4, contrast: 0.88, saturation: 0.85, brightness: 1.06 },
			{ colorGrade: "warm" as const, saturation: 0.7, contrast: 0.9, temperature: 0.4 },
			{ saturation: 1.5, contrast: 1.15, temperature: -0.5, brightness: 0.95 },
			{ colorGrade: "cool" as const, brightness: 0.88, contrast: 1.1, blur: 1, temperature: -0.3 },
		];
		const pick = looks[Math.floor(Math.random() * looks.length)];
		const baseline: Partial<Scene["background"]> = {
			colorGrade: undefined,
			brightness: 1,
			contrast: 1,
			saturation: 1,
			temperature: 0,
			blur: 0,
		};
		setBg({ ...baseline, ...pick });
		toast("Random look applied", { duration: 800 });
	};

	const PRESETS: { id: NonNullable<Scene["background"]["colorGrade"]> | "none"; label: string }[] = [
		{ id: "none", label: "None" },
		{ id: "warm", label: "Warm" },
		{ id: "cool", label: "Cool" },
		{ id: "punchy", label: "Punchy" },
		{ id: "bw", label: "B&W" },
		{ id: "neutral", label: "Neutral" },
	];

	return (
		<div className="space-y-3">
			<Field label="Preset">
				<div className="grid grid-cols-3 gap-1.5">
					{PRESETS.map((p) => {
						const cur = bg.colorGrade ?? "none";
						const active = cur === p.id;
						return (
							<button
								key={p.id}
								type="button"
								onClick={() =>
									setBg({ colorGrade: p.id === "none" ? undefined : p.id })
								}
								className={`text-[11px] py-1.5 rounded-md border transition-colors ${
									active
										? "border-purple-500 bg-purple-500/15 text-purple-200"
										: "border-neutral-700 text-neutral-400 hover:border-neutral-500"
								}`}
							>
								{p.label}
							</button>
						);
					})}
				</div>
			</Field>

			<div className="pt-2 mt-2 border-t border-neutral-800 space-y-3">
				<Slider
					label="Brightness"
					value={bg.brightness ?? 1}
					min={0.5}
					max={1.5}
					step={0.02}
					onChange={(v) => setBg({ brightness: v })}
					format={(v) => `${v.toFixed(2)}×`}
				/>
				<Slider
					label="Contrast"
					value={bg.contrast ?? 1}
					min={0.5}
					max={1.5}
					step={0.02}
					onChange={(v) => setBg({ contrast: v })}
					format={(v) => `${v.toFixed(2)}×`}
				/>
				<Slider
					label="Saturation"
					value={bg.saturation ?? 1}
					min={0}
					max={1.5}
					step={0.02}
					onChange={(v) => setBg({ saturation: v })}
					format={(v) => `${v.toFixed(2)}×`}
				/>
				<Slider
					label="Temperature"
					value={bg.temperature ?? 0}
					min={-1}
					max={1}
					step={0.05}
					onChange={(v) => setBg({ temperature: v })}
					format={(v) =>
						v > 0 ? `+${v.toFixed(2)} warm` : v < 0 ? `${v.toFixed(2)} cool` : "neutral"
					}
				/>
				<Slider
					label="Blur"
					value={bg.blur ?? 0}
					min={0}
					max={20}
					step={0.5}
					onChange={(v) => setBg({ blur: v })}
					format={(v) => `${v.toFixed(1)}px`}
				/>
				<Slider
					label="Vignette"
					value={bg.vignette ?? 0.5}
					min={0}
					max={0.8}
					step={0.05}
					onChange={(v) => setBg({ vignette: v })}
					format={(v) => `${(v * 100).toFixed(0)}%`}
				/>
			</div>

			<div className="pt-2 mt-2 border-t border-neutral-800 grid grid-cols-3 gap-2">
				<button
					type="button"
					onClick={reset}
					className="text-xs px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-red-500 hover:text-red-300"
				>
					Reset
				</button>
				<button
					type="button"
					onClick={applyToAll}
					className="text-xs px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
				>
					Apply to all
				</button>
				<button
					type="button"
					onClick={surprise}
					className="text-xs px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-300"
				>
					Surprise ✨
				</button>
			</div>
		</div>
	);
}

function KeyingBody({ scene, update }: SectionProps) {
	const chroma = scene.background.chromaKey;
	const luma = scene.background.lumaKey;

	const setChroma = (
		patch: Partial<NonNullable<Scene["background"]["chromaKey"]>> | null,
	) => {
		if (patch === null) {
			update({ background: { ...scene.background, chromaKey: undefined } });
			return;
		}
		update({
			background: {
				...scene.background,
				chromaKey: {
					color: chroma?.color ?? "#00ff00",
					tolerance: chroma?.tolerance ?? 0.4,
					softness: chroma?.softness ?? 0.3,
					...patch,
				},
			},
		});
	};

	const setLuma = (
		patch: Partial<NonNullable<Scene["background"]["lumaKey"]>> | null,
	) => {
		if (patch === null) {
			update({ background: { ...scene.background, lumaKey: undefined } });
			return;
		}
		update({
			background: {
				...scene.background,
				lumaKey: {
					threshold: luma?.threshold ?? 0.3,
					softness: luma?.softness ?? 0.05,
					invert: luma?.invert ?? false,
					...patch,
				},
			},
		});
	};

	return (
		<div className="space-y-3">
			<section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
				<label className="flex items-center justify-between text-xs">
					<span className="text-neutral-200 font-semibold">Chroma key</span>
					<input
						type="checkbox"
						checked={!!chroma}
						onChange={(e) => (e.target.checked ? setChroma({}) : setChroma(null))}
						className="accent-emerald-500"
					/>
				</label>
				{chroma && (
					<div className="space-y-2 pt-1">
						<Field label="Color">
							<input
								type="color"
								value={chroma.color}
								onChange={(e) => setChroma({ color: e.target.value })}
								className="h-9 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
							/>
						</Field>
						<Slider
							label="Tolerance"
							value={chroma.tolerance}
							min={0}
							max={1}
							step={0.02}
							onChange={(v) => setChroma({ tolerance: v })}
							format={(v) => `${(v * 100).toFixed(0)}%`}
							accent="emerald"
						/>
						<Slider
							label="Softness"
							value={chroma.softness}
							min={0}
							max={1}
							step={0.05}
							onChange={(v) => setChroma({ softness: v })}
							format={(v) => `${(v * 100).toFixed(0)}%`}
							accent="emerald"
						/>
					</div>
				)}
			</section>

			<section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
				<label className="flex items-center justify-between text-xs">
					<span className="text-neutral-200 font-semibold">Luma key</span>
					<input
						type="checkbox"
						checked={!!luma}
						onChange={(e) => (e.target.checked ? setLuma({}) : setLuma(null))}
						className="accent-emerald-500"
					/>
				</label>
				{luma && (
					<div className="space-y-2 pt-1">
						<Slider
							label="Threshold"
							value={luma.threshold}
							min={0}
							max={1}
							step={0.02}
							onChange={(v) => setLuma({ threshold: v })}
							format={(v) => `${(v * 100).toFixed(0)}%`}
							accent="emerald"
						/>
						<Slider
							label="Softness"
							value={luma.softness}
							min={0}
							max={0.5}
							step={0.02}
							onChange={(v) => setLuma({ softness: v })}
							format={(v) => `${(v * 100).toFixed(0)}%`}
							accent="emerald"
						/>
						<label className="flex items-center gap-2 text-[11px] text-neutral-300 pt-1">
							<input
								type="checkbox"
								checked={!!luma.invert}
								onChange={(e) => setLuma({ invert: e.target.checked })}
								className="accent-emerald-500"
							/>
							Invert (cull bright pixels instead of dark)
						</label>
					</div>
				)}
			</section>
		</div>
	);
}

/* ─────────────────────────── Effects ─────────────────────────── */

export function EffectsTrigger({
	scene,
	onOpen,
}: {
	scene: Scene;
	onOpen: () => void;
}) {
	const active =
		(scene.zoomPunch ?? 0) > 0 ||
		(scene.shakeIntensity ?? 0) > 0 ||
		(scene.transition && scene.transition !== "none");
	return (
		<ModalTrigger
			onClick={onOpen}
			icon={<Zap className="h-4 w-4" />}
			label="Effects"
			hint={active ? "Active" : "Zoom punch · screen shake · beat flash"}
			accent="amber"
		/>
	);
}

export function EffectsModal({
	open,
	onClose,
	scene,
	update,
}: { open: boolean; onClose: () => void } & SectionProps) {
	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Effects"
			subtitle="Punch up the scene with zooms, shakes, and flashes."
			accent="amber"
			width="default"
		>
			<Slider
				label="Zoom punch"
				value={scene.zoomPunch ?? 0}
				min={0}
				max={1.4}
				step={0.05}
				onChange={(v) => update({ zoomPunch: v })}
				format={(v) => (v ? `${((v - 1) * 100).toFixed(0)}% overshoot` : "off")}
				accent="amber"
			/>
			<Slider
				label="Screen shake"
				value={scene.shakeIntensity ?? 0}
				min={0}
				max={15}
				step={1}
				onChange={(v) => update({ shakeIntensity: v })}
				format={(v) => `${v}px`}
				accent="amber"
			/>
			<Field label="Beat flash">
				<div className="grid grid-cols-3 gap-1.5">
					{(
						[
							["none", "None"],
							["beat_flash", "White"],
							["beat_flash_colored", "Color"],
						] as const
					).map(([v, l]) => (
						<button
							key={v}
							type="button"
							onClick={() => update({ transition: v as Scene["transition"] })}
							className={`text-[11px] py-1.5 rounded-md border transition-colors ${
								(scene.transition ?? "none") === v
									? "border-amber-500 bg-amber-500/10 text-amber-300"
									: "border-neutral-700 text-neutral-400 hover:border-neutral-500"
							}`}
						>
							{l}
						</button>
					))}
				</div>
			</Field>
			{scene.transition === "beat_flash_colored" && (
				<Field label="Flash color">
					<input
						type="color"
						value={scene.transitionColor ?? "#10b981"}
						onChange={(e) => update({ transitionColor: e.target.value })}
						className="h-9 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
					/>
				</Field>
			)}
			<div className="pt-2 mt-2 border-t border-neutral-800 space-y-3">
				<div className="text-[10px] uppercase tracking-wider text-neutral-500">
					Speed & audio
				</div>
				<Slider
					label="Speed"
					value={scene.speedFactor ?? 1}
					min={0.25}
					max={4}
					step={0.05}
					onChange={(v) => update({ speedFactor: v })}
					format={(v) =>
						`${v.toFixed(2)}× ${v < 1 ? "(slow)" : v > 1 ? "(fast)" : "(normal)"}`
					}
					accent="amber"
				/>
				<Slider
					label="Volume"
					value={scene.audioGain ?? 1}
					min={0}
					max={2}
					step={0.05}
					onChange={(v) => update({ audioGain: v })}
					format={(v) => (v === 0 ? "muted" : `${(v * 100).toFixed(0)}%`)}
					accent="amber"
				/>
			</div>
		</PropertyModal>
	);
}

/* ─────────────────────────── Animate ─────────────────────────── */

export function AnimateTrigger({
	scene,
	onOpen,
}: {
	scene: Scene;
	onOpen: () => void;
}) {
	const trackCount = Object.keys(scene.keyframes ?? {}).length;
	return (
		<ModalTrigger
			onClick={onOpen}
			icon={<Activity className="h-4 w-4" />}
			label="Animate"
			hint={
				trackCount > 0
					? `${trackCount} track${trackCount === 1 ? "" : "s"} active`
					: "Keyframe scale, position, opacity over time"
			}
			accent="cyan"
		/>
	);
}

function defaultValueFor(property: KeyframeProperty, scene: Scene): number {
	if (property === "textY") return scene.textY ?? 300;
	if (
		property === "textScale" ||
		property === "emphasisScale" ||
		property === "characterScale" ||
		property === "bgScale"
	) {
		return 1;
	}
	if (property.endsWith("Opacity")) return 1;
	return 0;
}


/* ─────────────────────────── Animate redesign ─────────────────────────── */

type EasingName = NonNullable<Keyframe["easing"]>;

const EASING_OPTIONS: EasingName[] = [
	"linear",
	"ease_in",
	"ease_out",
	"ease_in_out",
	"ease_in_back",
	"ease_out_back",
	"ease_in_out_back",
	"spring",
	"snappy",
	"bouncy",
	"custom",
];

/* User-friendly labels for keyframe properties — non-editors don't
 * know "bgScale" or "bgOffsetX". These names show up everywhere
 * properties are exposed (picker, timeline labels, inspector, chips). */
const PROPERTY_LABELS: Record<KeyframeProperty, string> = {
	bgScale: "Zoom",
	bgOffsetX: "Pan X",
	bgOffsetY: "Pan Y",
	bgRotation: "Rotate",
	overlayOpacity: "Overlay fade",
	characterY: "Character Y",
	characterScale: "Character size",
	textY: "Text position",
	textScale: "Text size",
	textOpacity: "Text fade",
	emphasisY: "Emphasis position",
	emphasisScale: "Emphasis size",
	emphasisOpacity: "Emphasis fade",
};

function propLabel(p: KeyframeProperty): string {
	return PROPERTY_LABELS[p] ?? p;
}

/**
 * Resolve every active keyframe track at `frame` and return a flat
 * map of property→value. Used by MediaAnimationPreview to render the
 * scene with all animations playing in parallel.
 */
function resolveAllAt(scene: Scene, frame: number): Partial<Record<KeyframeProperty, number>> {
	const out: Partial<Record<KeyframeProperty, number>> = {};
	const tracks = scene.keyframes ?? {};
	for (const [k, kfs] of Object.entries(tracks)) {
		if (!kfs || kfs.length === 0) continue;
		out[k as KeyframeProperty] = evaluateKeyframes(frame, kfs);
	}
	return out;
}

function MediaAnimationPreview({
	scene,
	frame,
	durationFrames,
	playing,
	onTogglePlay,
	fps,
}: {
	scene: Scene;
	frame: number;
	durationFrames: number;
	playing: boolean;
	onTogglePlay: () => void;
	fps: number;
}) {
	const values = resolveAllAt(scene, frame);

	const bgScale = values.bgScale ?? scene.background.imageScale ?? 1;
	const bgOffsetX = values.bgOffsetX ?? scene.background.imageOffsetX ?? 0;
	const bgOffsetY = values.bgOffsetY ?? scene.background.imageOffsetY ?? 0;
	const bgRotation = values.bgRotation ?? 0;
	const overlayOpacity = values.overlayOpacity ?? 0;

	const charScale = values.characterScale ?? scene.characterScale ?? 1;
	const charY = values.characterY ?? scene.characterY ?? 950;

	const textY = values.textY ?? scene.textY ?? 300;
	const textScale = values.textScale ?? 1;
	const textOpacity = values.textOpacity ?? 1;
	const emphScale = values.emphasisScale ?? 1;
	const emphOpacity = values.emphasisOpacity ?? 1;
	const emphY = values.emphasisY ?? 700;

	const FW = 1920;
	const FH = 1080;

	const activeProps = Object.keys(values) as KeyframeProperty[];

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-[10px]">
				<button
					type="button"
					onClick={onTogglePlay}
					className="h-7 w-7 rounded flex items-center justify-center text-cyan-300 hover:bg-cyan-500/15 transition-colors"
					title={playing ? "Pause" : "Play"}
				>
					{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
				</button>
				<span className="uppercase tracking-wider text-neutral-500">Live preview</span>
				<span className="ml-auto font-mono text-cyan-200 tabular-nums">
					{(frame / fps).toFixed(2)}s / {(durationFrames / fps).toFixed(2)}s
				</span>
			</div>

			{/* Active-animations chip row so users see at a glance which
			    properties are driving the live motion below. */}
			{activeProps.length > 0 && (
				<div className="flex flex-wrap items-center gap-1">
					<span className="text-[9px] uppercase tracking-wider text-neutral-500">
						Now animating
					</span>
					{activeProps.map((p) => (
						<span
							key={p}
							className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 font-medium tabular-nums"
							title={`${propLabel(p)}: ${(values[p] ?? 0).toFixed(2)}`}
						>
							{propLabel(p)}{" "}
							<span className="text-cyan-400/70">{(values[p] ?? 0).toFixed(2)}</span>
						</span>
					))}
				</div>
			)}

			<div
				className="relative w-full overflow-hidden rounded-md border border-neutral-800 bg-black aspect-video"
				style={{ backgroundColor: scene.background.color }}
			>
				{scene.background.videoUrl ? (
					<video
						src={scene.background.videoUrl}
						autoPlay
						muted
						playsInline
						loop
						className="absolute inset-0 w-full h-full"
						style={{
							objectFit: "cover",
							transform: `scale(${bgScale}) translate(${(bgOffsetX / FW) * 100}%, ${(bgOffsetY / FH) * 100}%) rotate(${bgRotation}deg)`,
							transformOrigin: "center center",
						}}
					/>
				) : scene.background.imageUrl ? (
					// biome-ignore lint/a11y/useAltText: decorative animation preview
					<img
						src={scene.background.imageUrl}
						alt=""
						className="absolute inset-0 w-full h-full"
						style={{
							objectFit: "cover",
							transform: `scale(${bgScale}) translate(${(bgOffsetX / FW) * 100}%, ${(bgOffsetY / FH) * 100}%) rotate(${bgRotation}deg)`,
							transformOrigin: "center center",
						}}
					/>
				) : null}

				{overlayOpacity > 0 && (
					<div
						aria-hidden
						className="absolute inset-0 bg-black"
						style={{ opacity: Math.max(0, Math.min(1, overlayOpacity)) }}
					/>
				)}

				{(scene.characterId || scene.characterUrl) && (
					<div
						className="absolute bg-emerald-500/30 border-2 border-emerald-400 rounded-md"
						style={{
							left: "50%",
							bottom: `${(1 - charY / FH) * 100}%`,
							width: `${((220 * charScale) / FW) * 100}%`,
							height: `${((440 * charScale) / FH) * 100}%`,
							transform: "translate(-50%, 0)",
						}}
					/>
				)}

				<div
					className="absolute left-1/2 text-white font-bold whitespace-nowrap"
					style={{
						top: `${(textY / FH) * 100}%`,
						transform: `translate(-50%, -50%) scale(${textScale})`,
						opacity: Math.max(0, Math.min(1, textOpacity)),
						fontSize: "clamp(10px, 2.4vw, 22px)",
					}}
				>
					Sample text
				</div>
				<div
					className="absolute left-1/2 text-amber-300 font-extrabold whitespace-nowrap"
					style={{
						top: `${(emphY / FH) * 100}%`,
						transform: `translate(-50%, -50%) scale(${emphScale})`,
						opacity: Math.max(0, Math.min(1, emphOpacity)),
						fontSize: "clamp(14px, 3vw, 32px)",
					}}
				>
					Punch!
				</div>

				<span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider text-white/70 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
					Live
				</span>
			</div>
		</div>
	);
}

interface SelectedKf {
	property: KeyframeProperty;
	frame: number;
}

function AnimationsTimeline({
	scene,
	frame,
	onFrameChange,
	durationFrames,
	selected,
	onSelect,
	onRemoveTrack,
	fps,
}: {
	scene: Scene;
	frame: number;
	onFrameChange: (f: number) => void;
	durationFrames: number;
	selected: SelectedKf | null;
	onSelect: (sel: SelectedKf | null) => void;
	onRemoveTrack: (p: KeyframeProperty) => void;
	fps: number;
}) {
	const upsertKeyframe = useProjectStore((s) => s.upsertKeyframe);
	const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
	const tracks = (Object.keys(scene.keyframes ?? {}) as KeyframeProperty[]).filter(
		(p) => (scene.keyframes?.[p]?.length ?? 0) > 0,
	);

	const xToFrame = (clientX: number, rect: DOMRect) =>
		Math.max(
			0,
			Math.min(durationFrames, ((clientX - rect.left) / rect.width) * durationFrames),
		);

	const addAtFrame = (p: KeyframeProperty, f: number) => {
		const rounded = Math.round(f);
		const value =
			(scene.keyframes?.[p] && scene.keyframes[p].length > 0
				? evaluateKeyframes(rounded, scene.keyframes[p])
				: defaultValueFor(p, scene));
		upsertKeyframe(scene.id, p, { frame: rounded, value, easing: "ease_in_out" });
		onSelect({ property: p, frame: rounded });
	};

	// Tick marks at every second + half-second.
	const ticks: number[] = [];
	const totalSec = durationFrames / fps;
	for (let s = 0; s <= totalSec; s += 0.5) ticks.push(s);

	return (
		<div className="rounded-md border border-neutral-800 bg-neutral-950 overflow-hidden">
			<div className="flex items-center gap-2 px-2 py-1.5 border-b border-neutral-800 bg-neutral-900/60">
				<span className="text-[10px] uppercase tracking-wider text-neutral-500">
					Timeline
				</span>
				<span className="text-[10px] text-neutral-600">
					· click empty space to add · drag to move · right-click to delete
				</span>
				<span className="ml-auto text-[10px] font-mono text-cyan-200 tabular-nums">
					{(frame / fps).toFixed(2)}s
				</span>
			</div>

			{tracks.length === 0 && (
				<div className="px-3 py-6 text-center text-[11px] text-neutral-500 italic">
					No animations yet — add one below to start.
				</div>
			)}

			{tracks.map((p) => {
				const kfs = scene.keyframes?.[p] ?? [];
				return (
					<div
						key={p}
						className="flex items-stretch border-t border-neutral-800 first:border-t-0"
					>
						<div className="w-28 shrink-0 px-2 py-1.5 flex items-center gap-1 bg-neutral-900/40 border-r border-neutral-800">
							<Activity className="h-3 w-3 text-cyan-400 shrink-0" />
							<span className="text-[10.5px] text-cyan-200 truncate flex-1" title={p}>
								{propLabel(p)}
							</span>
							<button
								type="button"
								onClick={() => onRemoveTrack(p)}
								className="text-neutral-600 hover:text-red-400 text-[14px] leading-none px-1"
								title="Remove track"
							>
								×
							</button>
						</div>
						<div
							className="relative flex-1 min-h-[28px] cursor-crosshair group"
							onPointerDown={(e) => {
								// Only fire on the bare track surface — keyframe dots
								// stop propagation in their own handlers.
								if (e.target !== e.currentTarget) return;
								const f = xToFrame(e.clientX, e.currentTarget.getBoundingClientRect());
								addAtFrame(p, f);
							}}
						>
							{/* Soft baseline */}
							<div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-neutral-800 pointer-events-none" />

							{/* Keyframe diamonds */}
							{kfs.map((k) => {
								const left = `${(k.frame / durationFrames) * 100}%`;
								const isSelected =
									selected?.property === p && selected.frame === k.frame;
								return (
									<button
										key={k.frame}
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onSelect({ property: p, frame: k.frame });
										}}
										onContextMenu={(e) => {
											e.preventDefault();
											e.stopPropagation();
											removeKeyframe(scene.id, p, k.frame);
											if (isSelected) onSelect(null);
										}}
										onPointerDown={(e) => {
											e.stopPropagation();
											const trackEl = e.currentTarget.parentElement;
											if (!trackEl) return;
											const rect = trackEl.getBoundingClientRect();
											const move = (ev: PointerEvent) => {
												const nf = Math.round(xToFrame(ev.clientX, rect));
												if (nf !== k.frame) {
													removeKeyframe(scene.id, p, k.frame);
													upsertKeyframe(scene.id, p, { ...k, frame: nf });
													onSelect({ property: p, frame: nf });
												}
											};
											const up = () => {
												window.removeEventListener("pointermove", move);
												window.removeEventListener("pointerup", up);
											};
											window.addEventListener("pointermove", move);
											window.addEventListener("pointerup", up);
										}}
										className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 transition-colors ${
											isSelected
												? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
												: "bg-cyan-300 hover:bg-cyan-200"
										}`}
										style={{ left }}
										title={`${(k.frame / fps).toFixed(2)}s = ${k.value.toFixed(2)}`}
									/>
								);
							})}

							{/* Playhead */}
							<div
								aria-hidden
								className="absolute top-0 bottom-0 w-px bg-cyan-400/80 pointer-events-none"
								style={{ left: `${(frame / durationFrames) * 100}%` }}
							/>
						</div>
					</div>
				);
			})}

			{/* Time ruler */}
			<div className="flex items-stretch border-t border-neutral-800 bg-neutral-900/40">
				<div className="w-28 shrink-0 px-2 py-1 text-[9px] uppercase tracking-wider text-neutral-600 border-r border-neutral-800">
					Time
				</div>
				<div
					className="relative flex-1 h-5 cursor-pointer"
					onPointerDown={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const f = xToFrame(e.clientX, rect);
						onFrameChange(f);
					}}
					onPointerMove={(e) => {
						if (e.buttons !== 1) return;
						const rect = e.currentTarget.getBoundingClientRect();
						onFrameChange(xToFrame(e.clientX, rect));
					}}
				>
					{ticks.map((s) => {
						const left = `${(s / totalSec) * 100}%`;
						const major = Number.isInteger(s);
						return (
							<span key={s} className="absolute top-0" style={{ left }}>
								<span
									className={`block w-px ${major ? "h-2 bg-neutral-600" : "h-1 bg-neutral-700"}`}
								/>
								{major && (
									<span className="absolute top-2 left-1 text-[9px] text-neutral-500 font-mono">
										{s}s
									</span>
								)}
							</span>
						);
					})}
					<div
						aria-hidden
						className="absolute top-0 bottom-0 w-px bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.7)]"
						style={{ left: `${(frame / durationFrames) * 100}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

function KeyframeInspector({
	scene,
	selected,
	onSelectFrame,
	fps,
	durationFrames,
}: {
	scene: Scene;
	selected: SelectedKf;
	onSelectFrame: (f: number) => void;
	fps: number;
	durationFrames: number;
}) {
	const upsertKeyframe = useProjectStore((s) => s.upsertKeyframe);
	const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
	const kfs = scene.keyframes?.[selected.property] ?? [];
	const kf = kfs.find((k) => k.frame === selected.frame);
	if (!kf) return null;

	const idx = kfs.indexOf(kf);
	const isLast = idx === kfs.length - 1;

	const update = (patch: Partial<Keyframe>) => {
		const nextFrame = patch.frame ?? kf.frame;
		// Clamp to [0, durationFrames].
		const clamped = Math.max(0, Math.min(durationFrames, Math.round(nextFrame)));
		const merged: Keyframe = { ...kf, ...patch, frame: clamped };
		// If the frame changed, remove the old + insert at new. Otherwise
		// upsertKeyframe handles same-frame replacement on its own.
		if (clamped !== kf.frame) {
			removeKeyframe(scene.id, selected.property, kf.frame);
			onSelectFrame(clamped);
		}
		upsertKeyframe(scene.id, selected.property, merged);
	};

	return (
		<div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
			<div className="flex items-center gap-2">
				<span className="h-2 w-2 rotate-45 bg-amber-300 shrink-0" />
				<span className="text-[11px] font-semibold text-amber-200">
					Keyframe · {propLabel(selected.property)}
				</span>
				<button
					type="button"
					onClick={() => {
						removeKeyframe(scene.id, selected.property, kf.frame);
					}}
					className="ml-auto text-[10px] text-red-400 hover:text-red-300"
				>
					Delete
				</button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div className="flex flex-col gap-1">
					<label className="text-[9px] uppercase tracking-wider text-neutral-500">
						Time (s)
					</label>
					<input
						type="number"
						step="0.01"
						min={0}
						max={(durationFrames / fps).toFixed(2)}
						value={(kf.frame / fps).toFixed(2)}
						onChange={(e) => {
							const sec = Number(e.target.value);
							if (!Number.isFinite(sec)) return;
							update({ frame: sec * fps });
						}}
						className="text-xs px-2 py-1 rounded bg-neutral-950 border border-neutral-700 text-neutral-200 focus:border-amber-400 focus:outline-none"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[9px] uppercase tracking-wider text-neutral-500">
						Value
					</label>
					<input
						type="number"
						step="any"
						value={kf.value}
						onChange={(e) => {
							const v = Number(e.target.value);
							if (!Number.isFinite(v)) return;
							update({ value: v });
						}}
						className="text-xs px-2 py-1 rounded bg-neutral-950 border border-neutral-700 text-neutral-200 focus:border-amber-400 focus:outline-none"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<label className="text-[9px] uppercase tracking-wider text-neutral-500">
					Easing {isLast ? "(end keyframe — no segment)" : "· drag the dots to reshape"}
				</label>
				{!isLast ? (
					<div className="flex items-start gap-3">
						<EasingGraph
							easing={kf.easing}
							bezier={kf.bezier}
							onChange={(next) =>
								update({ easing: next.easing, bezier: next.bezier })
							}
							accent="rgb(252 211 77)"
							width={180}
							height={120}
						/>
						<div className="flex-1 space-y-1.5">
							<select
								value={kf.easing ?? "ease_in_out"}
								onChange={(e) => {
									const value = e.target.value as EasingName;
									update({
										easing: value,
										bezier: value === "custom" ? kf.bezier : undefined,
									});
								}}
								className="w-full text-xs px-2 py-1 rounded bg-neutral-950 border border-neutral-700 text-neutral-200 focus:border-amber-400 focus:outline-none"
							>
								{EASING_OPTIONS.map((e) => (
									<option key={e} value={e}>
										{e.replace(/_/g, "-")}
									</option>
								))}
							</select>
							{kf.easing === "custom" && (
								<button
									type="button"
									onClick={() =>
										update({ easing: "ease_in_out", bezier: undefined })
									}
									className="text-[10px] text-neutral-500 hover:text-white px-1.5 py-0.5 rounded border border-neutral-800 hover:border-neutral-600"
								>
									Reset to ease-in-out
								</button>
							)}
						</div>
					</div>
				) : (
					<span className="text-[10px] text-neutral-500 italic">
						Easing only matters on the segment leaving a keyframe — this is the
						last one.
					</span>
				)}
			</div>
		</div>
	);
}

const PROPERTY_GROUPS: { label: string; props: KeyframeProperty[] }[] = [
	{ label: "Background", props: ["bgScale", "bgOffsetX", "bgOffsetY", "bgRotation", "overlayOpacity"] },
	{ label: "Character", props: ["characterY", "characterScale"] },
	{ label: "Main text", props: ["textY", "textScale", "textOpacity"] },
	{ label: "Emphasis text", props: ["emphasisY", "emphasisScale", "emphasisOpacity"] },
];

function AddAnimationButton({
	scene,
	onAdd,
}: {
	scene: Scene;
	onAdd: (p: KeyframeProperty) => void;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const activeTracks = new Set(
		Object.keys(scene.keyframes ?? {}) as KeyframeProperty[],
	);
	return (
		<div className="rounded-md border border-cyan-500/40 bg-cyan-500/5 overflow-hidden">
			<button
				type="button"
				onClick={() => setPickerOpen((v) => !v)}
				className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/10 transition-colors text-left"
			>
				<span className="h-6 w-6 rounded flex items-center justify-center bg-cyan-500/20 text-cyan-300">
					+
				</span>
				<span className="text-[12px] font-semibold text-cyan-200">
					Add animation
				</span>
				<span className="ml-auto text-cyan-400">{pickerOpen ? "▴" : "▾"}</span>
			</button>
			{pickerOpen && (
				<div className="px-3 pb-3 pt-1 space-y-3 border-t border-cyan-500/20">
					{PROPERTY_GROUPS.map((group) => (
						<div key={group.label}>
							<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1.5">
								{group.label}
							</div>
							<div className="grid grid-cols-3 gap-1.5">
								{group.props.map((p) => {
									const isActive = activeTracks.has(p);
									return (
										<button
											key={p}
											type="button"
											onClick={() => {
												onAdd(p);
												setPickerOpen(false);
											}}
											title={
												isActive
													? "Already animated — adds another keyframe at the playhead"
													: "Add new animation"
											}
											className={
												isActive
													? "text-[10.5px] py-1.5 rounded-md border border-cyan-700/60 bg-cyan-500/10 text-cyan-300/90 hover:border-cyan-500 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors"
													: "text-[10.5px] py-1.5 rounded-md border border-neutral-700 text-neutral-300 hover:border-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-200 transition-colors"
											}
										>
											{propLabel(p)}
											{isActive && <span className="ml-1 text-cyan-400">+</span>}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function AnimateModal({
	open,
	onClose,
	scene,
}: {
	open: boolean;
	onClose: () => void;
	scene: Scene;
}) {
	const fps = useProjectStore((s) => s.project.fps);
	const upsertKeyframe = useProjectStore((s) => s.upsertKeyframe);
	const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
	const durationFrames = Math.max(1, Math.round(scene.duration * fps));
	const [frame, setFrame] = useState(0);
	const [playing, setPlaying] = useState(true);
	const [selected, setSelected] = useState<SelectedKf | null>(null);
	const startRef = useRef<number | null>(null);

	useEffect(() => {
		if (!open) {
			setSelected(null);
			setFrame(0);
			setPlaying(true);
		}
	}, [open]);

	useEffect(() => {
		if (!open || !playing) {
			startRef.current = null;
			return;
		}
		let raf = 0;
		const tick = (t: number) => {
			if (startRef.current === null) startRef.current = t - (frame / fps) * 1000;
			const elapsedSec = (t - startRef.current) / 1000;
			const f = (elapsedSec * fps) % durationFrames;
			setFrame(f);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
		// biome-ignore lint/correctness/useExhaustiveDependencies: ref-based timestamp
	}, [open, playing, durationFrames, fps]);

	const togglePlay = () => {
		setPlaying((p) => !p);
		startRef.current = null;
	};

	const onScrub = (f: number) => {
		setFrame(f);
		setPlaying(false);
		startRef.current = null;
	};

	const addProperty = (p: KeyframeProperty) => {
		const existing = scene.keyframes?.[p];
		if (existing && existing.length > 0) {
			// Property already animated — drop a NEW keyframe at the
			// current playhead. Value is interpolated from the existing
			// curve so the new point sits naturally on the path; the user
			// can drag the value to create a new beat.
			const f = Math.round(frame);
			if (existing.some((k) => k.frame === f)) {
				// Already a keyframe exactly at the playhead — just select it.
				setSelected({ property: p, frame: f });
				return;
			}
			const v = evaluateKeyframes(f, existing);
			upsertKeyframe(scene.id, p, { frame: f, value: v, easing: "ease_in_out" });
			setSelected({ property: p, frame: f });
			return;
		}
		// First-time animation — seed start + end so motion is visible
		// immediately and the user can tweak without staring at a flat
		// single-keyframe track.
		const v0 = defaultValueFor(p, scene);
		const v1 = p.endsWith("Scale")
			? v0 * 1.2
			: p.endsWith("Opacity")
				? Math.max(0, Math.min(1, v0 < 0.5 ? 1 : 0))
				: v0 + 100;
		upsertKeyframe(scene.id, p, { frame: 0, value: v0, easing: "ease_in_out" });
		upsertKeyframe(scene.id, p, {
			frame: durationFrames,
			value: v1,
			easing: "ease_in_out",
		});
		setSelected({ property: p, frame: 0 });
	};

	const removeTrack = (p: KeyframeProperty) => {
		const kfs = scene.keyframes?.[p] ?? [];
		for (const k of kfs) removeKeyframe(scene.id, p, k.frame);
		if (selected?.property === p) setSelected(null);
	};

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Animate"
			subtitle="Preview plays live. Click empty timeline space to add a keyframe."
			accent="cyan"
			width="huge"
		>
			<div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3">
				<div className="min-w-0 md:sticky md:top-0 md:self-start space-y-2">
					<MediaAnimationPreview
						scene={scene}
						frame={frame}
						durationFrames={durationFrames}
						playing={playing}
						onTogglePlay={togglePlay}
						fps={fps}
					/>
				</div>

				<div className="min-w-0 space-y-3">
					<AnimationsTimeline
						scene={scene}
						frame={frame}
						onFrameChange={onScrub}
						durationFrames={durationFrames}
						selected={selected}
						onSelect={setSelected}
						onRemoveTrack={removeTrack}
						fps={fps}
					/>

					<AddAnimationButton scene={scene} onAdd={addProperty} />

					{selected && (
						<KeyframeInspector
							scene={scene}
							selected={selected}
							onSelectFrame={(f) =>
								setSelected({ property: selected.property, frame: f })
							}
							fps={fps}
							durationFrames={durationFrames}
						/>
					)}
				</div>
			</div>
		</PropertyModal>
	);
}
