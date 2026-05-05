"use client";

import { Mic2, Music, Volume2, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { Range } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { useProjectStore } from "@/store/project-store";

/**
 * Master mix panel — three faders writing into `project.audioMix`.
 * Composition.tsx multiplies these onto each track's volume so
 * changes show up in the preview immediately.
 *
 * Range 0..1.5 (1.0 = unity). Above 1.0 boosts the lane; the
 * renderer clamps internally so users can't blow speakers.
 */
const FADERS: Array<{
	key: "voice" | "music" | "sfx";
	label: string;
	icon: ReactNode;
}> = [
	{ key: "voice", label: "Voice", icon: <Mic2 className="h-3.5 w-3.5" /> },
	{ key: "music", label: "Music", icon: <Music className="h-3.5 w-3.5" /> },
	{ key: "sfx", label: "SFX", icon: <Wand2 className="h-3.5 w-3.5" /> },
];

export function AudioMixer() {
	const mix = useProjectStore((s) => s.project.audioMix);
	const setAudioMix = useProjectStore((s) => s.setAudioMix);

	const value = (key: "voice" | "music" | "sfx") => mix?.[key] ?? 1;

	return (
		<Panel
			accent="audio"
			title="Master mix"
			icon={<Volume2 className="h-3.5 w-3.5" />}
		>
			<div className="space-y-3">
				{FADERS.map((f) => {
					const v = value(f.key);
					return (
						<div key={f.key} className="space-y-1">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 text-[12px] text-neutral-300">
									{f.icon}
									<span>{f.label}</span>
								</div>
								<span className="text-[11px] font-mono text-neutral-400 tabular-nums">
									{Math.round(v * 100)}%
								</span>
							</div>
							<Range
								accent="audio"
								min={0}
								max={1.5}
								step={0.01}
								value={v}
								onChange={(e) =>
									setAudioMix({ [f.key]: Number(e.target.value) })
								}
							/>
							<div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
								<MicroBtn onClick={() => setAudioMix({ [f.key]: 0 })}>
									Mute
								</MicroBtn>
								<MicroBtn onClick={() => setAudioMix({ [f.key]: 1 })}>
									0 dB
								</MicroBtn>
								<MicroBtn onClick={() => setAudioMix({ [f.key]: 1.5 })}>
									+50%
								</MicroBtn>
							</div>
						</div>
					);
				})}
			</div>
			<p className="text-[11px] text-neutral-500 leading-relaxed">
				Master levels apply to the whole project — per-clip gain lives in the
				inspector.
			</p>
		</Panel>
	);
}

function MicroBtn({
	onClick,
	children,
}: {
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="hover:text-orange-200 transition-colors"
		>
			{children}
		</button>
	);
}
