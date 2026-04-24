import type { TCanvasSize } from "@/types/project";

/**
 * Computes the transform.scale value required to fill ("cover") the canvas
 * with the source, so there are no letterbox bars after the contain-fit that
 * the renderer applies by default.
 *
 * The renderer composes: drawn = source * min(canvasW/srcW, canvasH/srcH) * transform.scale
 * To cover the canvas we need drawn to equal source * max(canvasW/srcW, canvasH/srcH),
 * which gives transform.scale = max / min = max(a, 1/a) where a = (canvasW/canvasH) / (srcW/srcH).
 */
export function computeCoverScale({
	canvas,
	source,
}: {
	canvas: TCanvasSize;
	source: TCanvasSize;
}): number {
	if (source.width <= 0 || source.height <= 0) return 1;
	const canvasAspect = canvas.width / canvas.height;
	const sourceAspect = source.width / source.height;
	const ratio = canvasAspect / sourceAspect;
	return Math.max(ratio, 1 / ratio);
}

export type ReframeMode = "cover" | "contain";

export function computeReframeScale({
	mode,
	canvas,
	source,
}: {
	mode: ReframeMode;
	canvas: TCanvasSize;
	source: TCanvasSize;
}): number {
	if (mode === "contain") return 1;
	return computeCoverScale({ canvas, source });
}
