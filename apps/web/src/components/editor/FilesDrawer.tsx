"use client";

import { useEffect, useState } from "react";
import { VariablesPanel } from "./VariablesPanel";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|m4a)$/i;

export function FilesDrawer({
	projectId,
	reloadKey,
}: {
	projectId: string;
	reloadKey: number;
}) {
	const [files, setFiles] = useState<string[]>([]);
	const [bgRemoving, setBgRemoving] = useState<string | null>(null);
	const [bgError, setBgError] = useState<string | null>(null);
	const [bgTarget, setBgTarget] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/projects/${projectId}`)
			.then((r) => (r.ok ? r.json() : { files: [] }))
			.then((j) => {
				if (!cancelled) setFiles(j.files || []);
			})
			.catch(() => {
				if (!cancelled) setFiles([]);
			});
		return () => {
			cancelled = true;
		};
	}, [projectId, reloadKey]);

	async function upload(event: React.ChangeEvent<HTMLInputElement>) {
		const fileList = event.target.files;
		if (!fileList || fileList.length === 0) return;
		const form = new FormData();
		for (const f of Array.from(fileList)) form.append("file", f);
		await fetch(`/api/projects/${projectId}/upload`, {
			method: "POST",
			body: form,
		});
		event.target.value = "";
	}

	function editInChat(path: string) {
		// Hand the path off to Chat.tsx. The chat listener pre-fills the input
		// with an instruction referencing this asset, then focuses the textarea.
		window.dispatchEvent(
			new CustomEvent("vibeedit:edit-asset", { detail: { path } }),
		);
	}

	function playAsset(path: string) {
		// Open the raw asset in a new tab — browsers handle image/video/audio
		// natively, so this is the simplest "play" without a custom lightbox.
		const url = `/api/projects/${projectId}/files/${path}`;
		window.open(url, "_blank", "noopener,noreferrer");
	}

	async function removeBackground(path: string) {
		if (bgRemoving) return;
		setBgError(null);
		setBgRemoving(path);
		try {
			const sourceUrl = `/api/projects/${projectId}/files/${path}`;
			const sourceResponse = await fetch(sourceUrl);
			if (!sourceResponse.ok) throw new Error("could not read source image");
			const sourceBlob = await sourceResponse.blob();
			const { removeBackground: run } = await import(
				"@imgly/background-removal"
			);
			const resultBlob = await run(sourceBlob);
			const baseName =
				path.split("/").pop()?.replace(/\.[^.]+$/, "") || "image";
			const outName = `${baseName}-nobg.png`;
			const form = new FormData();
			form.append(
				"file",
				new File([resultBlob], outName, { type: "image/png" }),
			);
			const upResponse = await fetch(`/api/projects/${projectId}/upload`, {
				method: "POST",
				body: form,
			});
			if (!upResponse.ok) throw new Error("upload failed");
			const nextResponse = await fetch(`/api/projects/${projectId}`);
			if (!nextResponse.ok) throw new Error("refresh failed");
			const next = await nextResponse.json();
			setFiles(next.files || []);
		} catch (error) {
			setBgError((error as Error).message.slice(0, 200));
		} finally {
			setBgRemoving(null);
			setBgTarget(null);
		}
	}

	const assets = files.filter((p) => p.startsWith("assets/"));

	return (
		<div className="flex h-full flex-col">
			<VariablesPanel projectId={projectId} reloadKey={reloadKey} />

			<div className="border-b border-[var(--color-border)] p-3">
				<div className="mb-2 flex items-center justify-between">
					<div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
						Assets in this video
					</div>
					<label className="cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-fg)] hover:border-[var(--color-accent)]">
						+ Upload
						<input
							type="file"
							multiple
							className="hidden"
							onChange={upload}
						/>
					</label>
				</div>

				{assets.length === 0 ? (
					<label className="block cursor-pointer rounded-md border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)]">
						Drop image / video / audio here
						<input
							type="file"
							multiple
							className="hidden"
							onChange={upload}
						/>
					</label>
				) : (
					<div className="grid grid-cols-2 gap-2">
						{assets.map((path) => (
							<AssetTile
								key={path}
								path={path}
								projectId={projectId}
								onPlay={() => playAsset(path)}
								onEdit={() => editInChat(path)}
								onRemoveBg={() => {
									setBgTarget(path);
									removeBackground(path);
								}}
								removingBg={bgRemoving === path}
							/>
						))}
					</div>
				)}
				{bgError && (
					<p className="mt-2 text-[10px] text-[var(--color-danger)]">
						{bgError}
					</p>
				)}
				{bgTarget && bgRemoving && (
					<p className="mt-2 text-[10px] text-[var(--color-fg-muted)]">
						Removing background… (first run downloads ~30MB model)
					</p>
				)}
			</div>

			{/* Quick prompt: hand the whole composition to the agent. */}
			<div className="border-b border-[var(--color-border)] p-3">
				<button
					onClick={() =>
						window.dispatchEvent(
							new CustomEvent("vibeedit:edit-asset", {
								detail: { path: "the composition" },
							}),
						)
					}
					className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-left text-xs text-[var(--color-fg)] hover:border-[var(--color-accent)]"
				>
					<span className="font-semibold">✎ Edit the composition</span>
					<span className="ml-1 text-[var(--color-fg-muted)]">
						— ask the agent in chat
					</span>
				</button>
			</div>

			<div className="flex-1" />
		</div>
	);
}

function AssetTile({
	path,
	projectId,
	onPlay,
	onEdit,
	onRemoveBg,
	removingBg,
}: {
	path: string;
	projectId: string;
	onPlay: () => void;
	onEdit: () => void;
	onRemoveBg: () => void;
	removingBg: boolean;
}) {
	const url = `/api/projects/${projectId}/files/${path}`;
	const thumbUrl = `/api/projects/${projectId}/asset-thumb?path=${encodeURIComponent(path)}`;
	const isImage = IMAGE_EXT.test(path);
	const isVideo = VIDEO_EXT.test(path);
	const isAudio = AUDIO_EXT.test(path);
	const filename = path.split("/").pop() || path;

	return (
		<div
			title={filename}
			className="group relative aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] hover:border-[var(--color-fg-muted)]"
		>
			{isImage ? (
				<img
					src={url}
					alt={filename}
					className="h-full w-full object-cover"
				/>
			) : isVideo || isAudio ? (
				<img
					src={thumbUrl}
					alt={filename}
					className="h-full w-full object-cover"
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center text-xs text-[var(--color-fg-muted)]">
					{path.split(".").pop()}
				</div>
			)}

			{/* Asset type marker (small, bottom-left) */}
			{(isVideo || isAudio) && (
				<span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
					{isVideo ? "video" : "audio"}
				</span>
			)}

			{/* Hover overlay with actions */}
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
				<button
					onClick={onPlay}
					title="Play / open this asset"
					className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow hover:opacity-90"
				>
					▶
				</button>
				<button
					onClick={onEdit}
					title="Edit this asset — send to chat"
					className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow hover:opacity-90"
				>
					✎
				</button>
				{isImage && (
					<button
						onClick={onRemoveBg}
						disabled={removingBg}
						title="Remove background (runs locally)"
						className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-fg)] text-black shadow hover:opacity-90 disabled:opacity-50"
					>
						{removingBg ? "…" : "✂"}
					</button>
				)}
			</div>
		</div>
	);
}
