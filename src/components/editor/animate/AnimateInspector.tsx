"use client";

import { Bookmark, Check, Download, Film, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Panel } from "@/components/ui/Panel";
import {
	ANIMATION_TEMPLATES,
	type AnimationSpec,
	type AnimationTemplateId,
} from "@/lib/animate/spec";
import { toast } from "@/lib/toast";
import { useAiStatusStore } from "@/store/ai-status-store";
import { useAssetLibraryStore } from "@/store/asset-library-store";
import { useProjectStore } from "@/store/project-store";

interface Props {
	spec: AnimationSpec;
	onPatch: (next: Partial<AnimationSpec>) => void;
}

/**
 * Right-pane inspector for the active AnimationSpec. Lets the user
 * tweak duration, change the template, edit string/number/color
 * props, and run the four post-generation actions:
 *   - Render → mp4 (download or use elsewhere)
 *   - Use in project (drop the rendered mp4 onto a chosen scene as bg)
 *   - Save to library (persists the spec for cross-project reuse)
 *   - Remove
 */
export function AnimateInspector({ spec, onPatch }: Props) {
	const project = useProjectStore((s) => s.project);
	const updateScene = useProjectStore((s) => s.updateScene);
	const removeAnimation = useProjectStore((s) => s.removeAnimation);
	const addAsset = useAssetLibraryStore((s) => s.add);
	const assets = useAssetLibraryStore((s) => s.assets);

	const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
	const [rendering, setRendering] = useState(false);
	const [savedToLib, setSavedToLib] = useState(false);
	const [target, setTarget] = useState<string>(project.scenes[0]?.id ?? "");

	const tpl = ANIMATION_TEMPLATES[spec.templateId];

	const renderToMp4 = async (): Promise<string | null> => {
		setRendering(true);
		const taskId = `anim-render-${Date.now()}`;
		useAiStatusStore.getState().start({
			id: taskId,
			kind: "render",
			label: `Animate render · ${spec.name ?? tpl.label}`,
		});
		const toastId = toast.loading("Rendering animation…");
		try {
			const res = await fetch("/api/animate/render", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ spec }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error ?? `render failed (${res.status})`);
			setRenderedUrl(data.url);
			toast.dismiss(toastId);
			toast.success("Render complete");
			return data.url;
		} catch (e) {
			toast.dismiss(toastId);
			toast.error("Render failed", {
				description: e instanceof Error ? e.message : String(e),
			});
			return null;
		} finally {
			setRendering(false);
			useAiStatusStore.getState().end(taskId);
		}
	};

	const downloadMp4 = async () => {
		const url = renderedUrl ?? (await renderToMp4());
		if (!url) return;
		const a = document.createElement("a");
		a.href = url;
		a.download = `${(spec.name ?? "animation").replace(/[^\w-]+/g, "-")}.mp4`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	};

	const useInProject = async () => {
		if (!target) return;
		const url = renderedUrl ?? (await renderToMp4());
		if (!url) return;
		const scene = project.scenes.find((s) => s.id === target);
		if (!scene) return;
		updateScene(scene.id, {
			background: { ...scene.background, videoUrl: url },
		});
	};

	const saveToLibrary = async () => {
		const url = renderedUrl ?? (await renderToMp4());
		if (!url) return;
		if (assets.some((a) => a.url === url)) {
			setSavedToLib(true);
			return;
		}
		addAsset({
			kind: "animation",
			url,
			name: spec.name ?? tpl.label,
			tags: [spec.templateId],
			animationSpec: spec,
		});
		setSavedToLib(true);
		window.setTimeout(() => setSavedToLib(false), 1800);
	};

	const setProp = (key: string, value: unknown) => {
		onPatch({ props: { ...spec.props, [key]: value } });
	};

	return (
		<Panel
			accent="animate"
			title={spec.name ?? tpl.label}
			actions={
				<IconButton
					icon={<X className="h-3.5 w-3.5" />}
					label="Remove"
					variant="danger"
					onClick={() => removeAnimation(spec.id)}
				/>
			}
		>
			<Field label="Template" accent="animate">
				<Select
					accent="animate"
					value={spec.templateId}
					onChange={(e) => {
						const next = e.target.value as AnimationTemplateId;
						const tplNext = ANIMATION_TEMPLATES[next];
						onPatch({
							templateId: next,
							durationFrames: Math.round(tplNext.defaultDurationSec * spec.fps),
							props: { ...tplNext.defaultProps, ...spec.props },
							name: tplNext.label,
						});
						setRenderedUrl(null);
					}}
				>
					{Object.values(ANIMATION_TEMPLATES).map((t) => (
						<option key={t.id} value={t.id}>
							{t.label}
						</option>
					))}
				</Select>
			</Field>

			<Field label="Duration (seconds)" accent="animate">
				<Input
					accent="animate"
					type="number"
					min={0.5}
					max={30}
					step={0.1}
					value={(spec.durationFrames / spec.fps).toFixed(2)}
					onChange={(e) => {
						const sec = Math.max(0.5, Math.min(30, Number(e.target.value)));
						onPatch({ durationFrames: Math.max(1, Math.round(sec * spec.fps)) });
						setRenderedUrl(null);
					}}
				/>
			</Field>

			<div className="space-y-2 pt-2 border-t border-neutral-800/60">
				<div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-semibold">
					Props
				</div>
				<PropEditor spec={spec} setProp={setProp} />
			</div>

			<div className="space-y-2 pt-2 border-t border-neutral-800/60">
				<div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-semibold">
					Use this animation
				</div>
				<Button
					variant="primary"
					accent="animate"
					size="sm"
					fullWidth
					loading={rendering}
					onClick={downloadMp4}
					leadingIcon={<Download className="h-3.5 w-3.5" />}
				>
					{rendering
						? "Rendering…"
						: renderedUrl
							? "Download MP4"
							: "Render & download MP4"}
				</Button>

				{project.scenes.length > 0 ? (
					<div className="space-y-1.5">
						<Select
							accent="animate"
							value={target}
							onChange={(e) => setTarget(e.target.value)}
						>
							{project.scenes.map((s, i) => (
								<option key={s.id} value={s.id}>
									Scene {i + 1}
									{s.label ? ` · ${s.label}` : ""}
								</option>
							))}
						</Select>
						<Button
							variant="secondary"
							accent="animate"
							size="sm"
							fullWidth
							disabled={rendering || !target}
							onClick={useInProject}
							leadingIcon={<Film className="h-3.5 w-3.5" />}
						>
							Use as scene background
						</Button>
					</div>
				) : null}

				<Button
					variant="ghost"
					accent="animate"
					size="sm"
					fullWidth
					disabled={rendering}
					onClick={saveToLibrary}
					leadingIcon={
						savedToLib ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<Bookmark className="h-3.5 w-3.5" />
						)
					}
				>
					{savedToLib ? "Saved to library" : "Save to library"}
				</Button>

				{renderedUrl ? (
					<div className="space-y-1 pt-1">
						<div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-semibold">
							Rendered preview
						</div>
						{/* biome-ignore lint/a11y/useMediaCaption: rendered preview, no caption track */}
						<video src={renderedUrl} controls className="w-full rounded" />
					</div>
				) : null}
			</div>
		</Panel>
	);
}

function PropEditor({
	spec,
	setProp,
}: {
	spec: AnimationSpec;
	setProp: (key: string, value: unknown) => void;
}) {
	const entries = Object.entries(spec.props);
	if (entries.length === 0) {
		return <div className="text-[11px] text-neutral-500 italic">No props.</div>;
	}
	return (
		<div className="space-y-2">
			{entries.map(([key, value]) => (
				<PropRow key={key} k={key} v={value} onChange={(v) => setProp(key, v)} />
			))}
		</div>
	);
}

function PropRow({
	k,
	v,
	onChange,
}: {
	k: string;
	v: unknown;
	onChange: (v: unknown) => void;
}) {
	const isColor =
		typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

	if (Array.isArray(v)) {
		return (
			<Field label={k} accent="animate">
				<Textarea
					accent="animate"
					rows={Math.min(6, v.length + 1)}
					value={v.join("\n")}
					onChange={(e) =>
						onChange(
							e.target.value
								.split(/\n/)
								.map((s) => s.trim())
								.filter(Boolean),
						)
					}
					className="font-mono"
				/>
			</Field>
		);
	}

	if (typeof v === "number") {
		return (
			<Field
				label={
					<span className="flex items-center justify-between w-full">
						<span>{k}</span>
						<span className="font-mono text-neutral-500">{v}</span>
					</span>
				}
				accent="animate"
			>
				<Input
					accent="animate"
					type="number"
					value={v}
					onChange={(e) => onChange(Number(e.target.value))}
				/>
			</Field>
		);
	}

	if (isColor) {
		return (
			<Field label={k} accent="animate">
				<div className="flex gap-2 items-center">
					<input
						aria-label={`${k} color`}
						type="color"
						value={v as string}
						onChange={(e) => onChange(e.target.value)}
						className="h-7 w-10 rounded bg-transparent border border-neutral-800 cursor-pointer"
					/>
					<Input
						accent="animate"
						type="text"
						value={v as string}
						onChange={(e) => onChange(e.target.value)}
						className="flex-1 font-mono"
					/>
				</div>
			</Field>
		);
	}

	if (typeof v === "string") {
		const isLong = v.length > 40 || v.includes("\n");
		return (
			<Field label={k} accent="animate">
				{isLong ? (
					<Textarea
						accent="animate"
						rows={3}
						value={v}
						onChange={(e) => onChange(e.target.value)}
					/>
				) : (
					<Input
						accent="animate"
						type="text"
						value={v}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
			</Field>
		);
	}

	if (typeof v === "boolean") {
		return (
			<label className="flex items-center justify-between cursor-pointer">
				<span className="text-[11px] text-neutral-400">{k}</span>
				<input
					type="checkbox"
					checked={v}
					onChange={(e) => onChange(e.target.checked)}
					className="accent-fuchsia-400"
				/>
			</label>
		);
	}

	return (
		<div className="text-[11px] text-neutral-500 italic">
			{k}: <span className="font-mono">{JSON.stringify(v)}</span>
		</div>
	);
}
