/**
 * AI-powered scene detection for uploaded footage.
 * Detects scene changes by analyzing frame differences.
 *
 * This module provides client-side scene detection using canvas-based
 * frame comparison. For uploaded videos, it samples frames at regular
 * intervals and detects significant visual changes.
 */

export interface DetectedScene {
	startTime: number;
	endTime: number;
	duration: number;
	thumbnailDataUrl?: string;
}

export interface SceneDetectionResult {
	scenes: DetectedScene[];
	totalDuration: number;
	sceneCount: number;
}

/**
 * Detect scene changes in a video element by comparing frame histograms.
 * @param video - HTMLVideoElement to analyze
 * @param threshold - Sensitivity (0-1, lower = more scenes detected). Default 0.4
 * @param sampleInterval - Seconds between frame samples. Default 0.5
 */
export async function detectScenes(
	video: HTMLVideoElement,
	threshold = 0.4,
	sampleInterval = 0.5,
): Promise<SceneDetectionResult> {
	const duration = video.duration;
	if (!duration || !isFinite(duration)) {
		return { scenes: [], totalDuration: 0, sceneCount: 0 };
	}

	const canvas = document.createElement("canvas");
	const scale = 0.125; // Sample at 1/8 resolution for speed
	canvas.width = Math.floor(video.videoWidth * scale) || 160;
	canvas.height = Math.floor(video.videoHeight * scale) || 90;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return { scenes: [], totalDuration: duration, sceneCount: 0 };

	const sceneBreaks: number[] = [0]; // First scene starts at 0
	let previousHistogram: number[] | null = null;

	for (let time = 0; time < duration; time += sampleInterval) {
		await seekTo(video, time);
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const histogram = computeHistogram(imageData.data);

		if (previousHistogram) {
			const diff = histogramDifference(previousHistogram, histogram);
			if (diff > threshold) {
				sceneBreaks.push(time);
			}
		}
		previousHistogram = histogram;
	}

	// Build scene list
	const scenes: DetectedScene[] = [];
	for (let i = 0; i < sceneBreaks.length; i++) {
		const startTime = sceneBreaks[i];
		const endTime =
			i + 1 < sceneBreaks.length ? sceneBreaks[i + 1] : duration;
		scenes.push({
			startTime,
			endTime,
			duration: endTime - startTime,
		});
	}

	return {
		scenes,
		totalDuration: duration,
		sceneCount: scenes.length,
	};
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve) => {
		if (Math.abs(video.currentTime - time) < 0.01) {
			resolve();
			return;
		}
		const handler = () => {
			video.removeEventListener("seeked", handler);
			resolve();
		};
		video.addEventListener("seeked", handler);
		video.currentTime = time;
	});
}

function computeHistogram(data: Uint8ClampedArray): number[] {
	const bins = 64;
	const histogram = new Array(bins * 3).fill(0);
	const binSize = 256 / bins;

	for (let i = 0; i < data.length; i += 4) {
		histogram[Math.floor(data[i] / binSize)] += 1; // R
		histogram[bins + Math.floor(data[i + 1] / binSize)] += 1; // G
		histogram[bins * 2 + Math.floor(data[i + 2] / binSize)] += 1; // B
	}

	// Normalize
	const total = data.length / 4;
	for (let i = 0; i < histogram.length; i++) {
		histogram[i] /= total;
	}

	return histogram;
}

function histogramDifference(a: number[], b: number[]): number {
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff += Math.abs(a[i] - b[i]);
	}
	return diff / a.length;
}
