"use client";

import { Mic, Square, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/lib/toast";
import { useProjectStore } from "@/store/project-store";

/**
 * Mic capture panel. Uses the browser's MediaRecorder API (no extra
 * deps) to grab audio, previews it locally, and uploads via the
 * existing /api/assets/upload route — same pipeline as user file
 * uploads, so the resulting URL works in Composition.tsx.
 *
 * The user picks where to attach the result: a scene voiceover or a
 * free-floating SFX clip on the project timeline.
 */
export function RecordingPanel() {
	const project = useProjectStore((s) => s.project);
	const updateScene = useProjectStore((s) => s.updateScene);
	const addSfxClip = useProjectStore((s) => s.addSfxClip);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const startedAtRef = useRef<number>(0);
	const tickRef = useRef<number | null>(null);

	const [recording, setRecording] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
	const [target, setTarget] = useState<string>("project");
	const [uploading, setUploading] = useState(false);

	useEffect(() => {
		return () => {
			if (tickRef.current) window.clearInterval(tickRef.current);
			streamRef.current?.getTracks().forEach((t) => t.stop());
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	const start = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeCandidates = [
				"audio/webm;codecs=opus",
				"audio/webm",
				"audio/ogg;codecs=opus",
				"audio/mp4",
			];
			const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
			const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
			chunksRef.current = [];
			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
				const url = URL.createObjectURL(blob);
				setPreviewUrl((prev) => {
					if (prev) URL.revokeObjectURL(prev);
					return url;
				});
				setPreviewBlob(blob);
				streamRef.current?.getTracks().forEach((t) => t.stop());
				streamRef.current = null;
			};
			recorder.start();
			recorderRef.current = recorder;
			startedAtRef.current = Date.now();
			setElapsed(0);
			setRecording(true);
			tickRef.current = window.setInterval(() => {
				setElapsed((Date.now() - startedAtRef.current) / 1000);
			}, 100);
		} catch (e) {
			toast.error("Couldn't start microphone", {
				description: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const stop = () => {
		recorderRef.current?.stop();
		recorderRef.current = null;
		setRecording(false);
		if (tickRef.current) window.clearInterval(tickRef.current);
		tickRef.current = null;
	};

	const reset = () => {
		setPreviewBlob(null);
		setPreviewUrl((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
		setElapsed(0);
	};

	const upload = async () => {
		if (!previewBlob) return;
		setUploading(true);
		try {
			const ext = previewBlob.type.includes("ogg") ? "ogg" : previewBlob.type.includes("mp4") ? "m4a" : "webm";
			const file = new File([previewBlob], `recording-${Date.now()}.${ext}`, {
				type: previewBlob.type,
			});
			const form = new FormData();
			form.append("file", file);
			const res = await fetch("/api/assets/upload", { method: "POST", body: form });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error ?? `upload failed (${res.status})`);

			// Probe the actual duration from the audio element so we don't
			// rely on the elapsed timer (which can drift on slow machines).
			const durationSec = await measureDuration(previewUrl).catch(() => elapsed);

			if (target === "project") {
				const fps = project.fps;
				addSfxClip({
					id: `sfx_${Math.random().toString(36).slice(2, 10)}`,
					url: data.url,
					name: file.name,
					startFrame: 0,
					durationFrames: Math.max(1, Math.round(durationSec * fps)),
					gain: 1,
				});
			} else {
				const scene = project.scenes.find((s) => s.id === target);
				if (scene) {
					updateScene(scene.id, {
						voiceover: {
							audioUrl: data.url,
							audioDurationSec: durationSec,
							provider: "openai",
							voice: "recorded",
							text: "",
						},
					});
				}
			}
			reset();
			toast.success("Recording uploaded", {
				description:
					target === "project"
						? "Added to the project SFX lane."
						: "Attached to the chosen scene.",
			});
		} catch (e) {
			toast.error("Recording upload failed", {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setUploading(false);
		}
	};

	return (
		<Panel
			accent="audio"
			title="Record audio"
			icon={<Mic className="h-3.5 w-3.5" />}
		>
			<div className="flex items-center justify-between">
				<div className="text-[12px] font-mono tabular-nums text-neutral-200">
					{formatElapsed(elapsed)}
				</div>
				{recording ? (
					<Button
						variant="danger"
						size="sm"
						onClick={stop}
						leadingIcon={<Square className="h-3 w-3" />}
					>
						Stop
					</Button>
				) : (
					<Button
						variant="secondary"
						accent="audio"
						size="sm"
						onClick={start}
						leadingIcon={<Mic className="h-3 w-3" />}
					>
						Record
					</Button>
				)}
			</div>

			{recording ? (
				<div className="text-[11px] text-red-300/90 flex items-center gap-1.5">
					<span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> Recording…
				</div>
			) : null}

			{previewUrl ? (
				<div className="space-y-2">
					{/* biome-ignore lint/a11y/useMediaCaption: user recording preview, no caption track */}
					<audio src={previewUrl} controls className="w-full h-7" />
					<Field label="Attach to" accent="audio">
						<Select
							accent="audio"
							value={target}
							onChange={(e) => setTarget(e.target.value)}
							disabled={uploading}
						>
							<option value="project">Project timeline (free clip)</option>
							{project.scenes.map((s, i) => (
								<option key={s.id} value={s.id}>
									Scene {i + 1}
									{s.voiceover ? " (replaces existing)" : ""}
								</option>
							))}
						</Select>
					</Field>
					<div className="flex gap-2">
						<Button
							variant="primary"
							accent="audio"
							size="sm"
							fullWidth
							loading={uploading}
							onClick={upload}
							leadingIcon={<Upload className="h-3.5 w-3.5" />}
						>
							{uploading ? "Uploading…" : "Add to timeline"}
						</Button>
						<IconButton
							icon={<Trash2 className="h-3.5 w-3.5" />}
							label="Discard"
							onClick={reset}
							disabled={uploading}
							variant="danger"
						/>
					</div>
				</div>
			) : null}
		</Panel>
	);
}

function formatElapsed(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	const ms = Math.floor((sec - Math.floor(sec)) * 10);
	return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

function measureDuration(url: string | null): Promise<number> {
	return new Promise((resolve, reject) => {
		if (!url) return reject(new Error("no url"));
		const audio = new Audio();
		audio.preload = "metadata";
		audio.onloadedmetadata = () => resolve(audio.duration || 0);
		audio.onerror = () => reject(new Error("metadata load failed"));
		audio.src = url;
	});
}
