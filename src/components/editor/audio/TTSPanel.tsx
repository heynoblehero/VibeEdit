"use client";

import { Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/lib/toast";
import { useActivityStore } from "@/store/activity-store";
import { useAiStatusStore } from "@/store/ai-status-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Generate a voiceover via OpenAI TTS. The mp3 lands as either:
 *   - a Voiceover on a chosen scene (replaces the existing one), or
 *   - a free-floating SFX clip on the project timeline if no scene is
 *     picked.
 *
 * The route at /api/tts handles the upstream call and writes the file
 * to the uploads dir; the client attaches whatever URL comes back.
 */
const VOICES = [
	{ id: "alloy", label: "Alloy — neutral" },
	{ id: "ash", label: "Ash — warm" },
	{ id: "coral", label: "Coral — bright" },
	{ id: "echo", label: "Echo — soft male" },
	{ id: "fable", label: "Fable — narrative" },
	{ id: "onyx", label: "Onyx — deep" },
	{ id: "nova", label: "Nova — energetic" },
	{ id: "sage", label: "Sage — calm" },
	{ id: "shimmer", label: "Shimmer — bright female" },
];

const MODELS = [
	{ id: "tts-1", label: "tts-1 (fast)" },
	{ id: "tts-1-hd", label: "tts-1-hd (higher fidelity)" },
];

export function TTSPanel() {
	const project = useProjectStore((s) => s.project);
	const updateScene = useProjectStore((s) => s.updateScene);
	const addSfxClip = useProjectStore((s) => s.addSfxClip);

	const [text, setText] = useState("");
	const [voice, setVoice] = useState("alloy");
	const [model, setModel] = useState("tts-1");
	const [target, setTarget] = useState<string>("project");
	const [busy, setBusy] = useState(false);
	const [lastUrl, setLastUrl] = useState<string | null>(null);

	const submit = async () => {
		if (!text.trim()) return;
		setBusy(true);
		const taskId = `tts-${Date.now()}`;
		useAiStatusStore.getState().start({
			id: taskId,
			kind: "voiceover",
			label: `Voiceover · ${text.slice(0, 28)}${text.length > 28 ? "…" : ""}`,
		});
		try {
			const res = await fetch("/api/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, voice, model, provider: "openai" }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error ?? `TTS failed (${res.status})`);
			}
			setLastUrl(data.url);

			if (target === "project") {
				const fps = project.fps;
				addSfxClip({
					id: `sfx_${Math.random().toString(36).slice(2, 10)}`,
					url: data.url,
					name: data.name ?? "TTS clip",
					startFrame: 0,
					durationFrames: Math.max(1, Math.round((data.durationSec ?? 5) * fps)),
					gain: 1,
				});
				toast.success("Voiceover generated", {
					description: "Added as a free clip on the project timeline.",
				});
				useActivityStore.getState().log({
					projectId: project.id,
					kind: "voiceover",
					label: `Voiceover added · ${voice}`,
				});
			} else {
				const scene = project.scenes.find((s) => s.id === target);
				if (scene) {
					updateScene(scene.id, {
						voiceover: {
							audioUrl: data.url,
							audioDurationSec: data.durationSec ?? 5,
							provider: "openai",
							voice,
							text,
						},
					});
					toast.success("Voiceover generated", {
						description: `Attached to scene ${project.scenes.indexOf(scene) + 1}.`,
					});
				}
			}
		} catch (e) {
			toast.error("Voiceover failed", {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setBusy(false);
			useAiStatusStore.getState().end(taskId);
		}
	};

	return (
		<Panel
			accent="audio"
			title="Generate voiceover"
			icon={<Sparkles className="h-3.5 w-3.5" />}
		>
			<Textarea
				accent="audio"
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Type the line you want spoken…"
				rows={4}
				disabled={busy}
			/>
			<div className="flex justify-end text-[10px] text-neutral-500 font-mono">
				{text.length} / 4000
			</div>
			<Field label="Voice" accent="audio">
				<Select
					accent="audio"
					value={voice}
					onChange={(e) => setVoice(e.target.value)}
					disabled={busy}
				>
					{VOICES.map((v) => (
						<option key={v.id} value={v.id}>
							{v.label}
						</option>
					))}
				</Select>
			</Field>
			<Field label="Model" accent="audio">
				<Select
					accent="audio"
					value={model}
					onChange={(e) => setModel(e.target.value)}
					disabled={busy}
				>
					{MODELS.map((m) => (
						<option key={m.id} value={m.id}>
							{m.label}
						</option>
					))}
				</Select>
			</Field>
			<Field label="Attach to" accent="audio">
				<Select
					accent="audio"
					value={target}
					onChange={(e) => setTarget(e.target.value)}
					disabled={busy}
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
			<Button
				variant="primary"
				accent="audio"
				size="sm"
				fullWidth
				loading={busy}
				disabled={!text.trim()}
				leadingIcon={<Wand2 className="h-3.5 w-3.5" />}
				onClick={submit}
			>
				{busy ? "Generating…" : "Generate"}
			</Button>
			{lastUrl && !busy ? (
				<div className="space-y-1 pt-1">
					<div className="text-[10px] uppercase tracking-wider text-orange-300/80 font-semibold">
						Last generation
					</div>
					{/* biome-ignore lint/a11y/useMediaCaption: user-generated TTS preview, no caption track */}
					<audio src={lastUrl} controls className="w-full h-7" />
				</div>
			) : null}
		</Panel>
	);
}
