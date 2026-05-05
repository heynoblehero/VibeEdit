"use client";

import { Player } from "@remotion/player";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AnimationSpec } from "@/lib/animate/spec";
import { AnimationComposition } from "@/remotion/animate/AnimationComposition";

/**
 * Live preview of one AnimationSpec via the Remotion Player. Sized to
 * the spec's own aspect ratio (so a 16:9 logo reveal and a 9:16
 * kinetic title both look right). The chrome is magenta to match the
 * Animate workspace.
 */
interface Props {
	spec: AnimationSpec;
}

export function AnimatePreview({ spec }: Props) {
	const [playing, setPlaying] = useState(false);
	const playerRef = useRef<React.ComponentRef<typeof Player> | null>(null);

	useEffect(() => {
		// Reset to start when the spec id flips so a new generation
		// starts from frame 0 instead of resuming wherever the previous
		// preview was.
		setPlaying(false);
	}, [spec.id]);

	return (
		<div className="flex flex-col gap-2 h-full">
			<div className="flex items-center justify-between">
				<span className="text-[10px] uppercase tracking-wider text-fuchsia-300 font-semibold">
					Live preview
				</span>
				<span className="text-[10px] font-mono text-neutral-500 tabular-nums">
					{(spec.durationFrames / spec.fps).toFixed(2)}s · {spec.width}×{spec.height} ·{" "}
					{spec.fps}fps
				</span>
			</div>
			<div
				className="flex-1 min-h-0 flex items-center justify-center"
				style={{ containerType: "size" }}
			>
				<div
					className="relative bg-black rounded-md overflow-hidden border border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/10"
					style={{
						width: `min(100cqw, 100cqh * ${spec.width} / ${spec.height})`,
						height: `min(100cqh, 100cqw * ${spec.height} / ${spec.width})`,
					}}
				>
					<Player
						key={spec.id}
						ref={playerRef}
						component={AnimationComposition}
						inputProps={{
							templateId: spec.templateId,
							props: spec.props,
							durationInFrames: spec.durationFrames,
							fps: spec.fps,
							width: spec.width,
							height: spec.height,
						}}
						durationInFrames={Math.max(1, spec.durationFrames)}
						fps={spec.fps}
						compositionWidth={spec.width}
						compositionHeight={spec.height}
						style={{ width: "100%", height: "100%" }}
						controls={false}
						loop
						autoPlay={false}
					/>
				</div>
			</div>
			<div className="flex items-center justify-center">
				<button
					type="button"
					onClick={() => {
						const p = playerRef.current;
						if (!p) return;
						if (playing) {
							p.pause();
							setPlaying(false);
						} else {
							p.play();
							setPlaying(true);
						}
					}}
					className="px-3 py-1.5 rounded bg-fuchsia-500 hover:bg-fuchsia-400 text-neutral-950 font-semibold text-[11px] flex items-center gap-1"
				>
					{playing ? (
						<Pause className="h-3.5 w-3.5 fill-current" />
					) : (
						<Play className="h-3.5 w-3.5 fill-current" />
					)}
					{playing ? "Pause" : "Play"}
				</button>
			</div>
		</div>
	);
}
