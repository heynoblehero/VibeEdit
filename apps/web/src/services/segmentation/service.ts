import {
	FaceLandmarker,
	ImageSegmenter,
	FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM_CDN =
	"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_LANDMARKER_MODEL =
	"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SELFIE_SEGMENTER_MODEL =
	"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

export class SegmentationService {
	private faceLandmarker: FaceLandmarker | null = null;
	private imageSegmenter: ImageSegmenter | null = null;
	private _isInitialized = false;
	private isInitializing = false;
	private lastFaceTimestamp = -1;
	private lastSegTimestamp = -1;

	/**
	 * Loads both FaceLandmarker and ImageSegmenter models.
	 * Uses FilesetResolver.forVisionTasks() to load WASM runtime,
	 * then initializes both models from CDN.
	 */
	async initialize(
		onProgress?: (progress: number) => void,
	): Promise<void> {
		if (this._isInitialized || this.isInitializing) return;
		this.isInitializing = true;

		try {
			onProgress?.(0);

			const wasmFileset = await FilesetResolver.forVisionTasks(WASM_CDN);
			onProgress?.(20);

			const [faceLandmarker, imageSegmenter] = await Promise.all([
				FaceLandmarker.createFromOptions(wasmFileset, {
					baseOptions: {
						modelAssetPath: FACE_LANDMARKER_MODEL,
						delegate: "GPU",
					},
					runningMode: "VIDEO",
					numFaces: 1,
					outputFaceBlendshapes: false,
					outputFacialTransformationMatrixes: false,
				}),
				ImageSegmenter.createFromOptions(wasmFileset, {
					baseOptions: {
						modelAssetPath: SELFIE_SEGMENTER_MODEL,
						delegate: "GPU",
					},
					runningMode: "VIDEO",
					outputCategoryMask: false,
					outputConfidenceMasks: true,
				}),
			]);

			this.faceLandmarker = faceLandmarker;
			onProgress?.(80);

			this.imageSegmenter = imageSegmenter;
			onProgress?.(100);

			this._isInitialized = true;
		} catch (error) {
			console.error("[SegmentationService] Initialization failed:", error);
			throw error;
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Runs face landmark detection on a video frame.
	 * Returns 468 landmarks per face, or null if no face is detected.
	 * Must pass a monotonically increasing timestamp for VIDEO mode.
	 */
	detectFace(
		videoFrame: HTMLVideoElement | HTMLCanvasElement,
	): FaceLandmarkerResult | null {
		if (!this.faceLandmarker) return null;

		const timestamp = performance.now();
		// MediaPipe VIDEO mode requires strictly increasing timestamps
		if (timestamp <= this.lastFaceTimestamp) {
			this.lastFaceTimestamp += 1;
		} else {
			this.lastFaceTimestamp = timestamp;
		}

		try {
			const result = this.faceLandmarker.detectForVideo(
				videoFrame,
				this.lastFaceTimestamp,
			);
			if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
				return null;
			}
			return result;
		} catch (error) {
			console.warn("[SegmentationService] Face detection error:", error);
			return null;
		}
	}

	/**
	 * Runs selfie segmentation on a video frame.
	 * Returns a confidence mask as Float32Array where each value is 0-1
	 * (0 = background, 1 = person), or null on failure.
	 */
	segmentPerson(
		videoFrame: HTMLVideoElement | HTMLCanvasElement,
	): Float32Array | null {
		if (!this.imageSegmenter) return null;

		const timestamp = performance.now();
		if (timestamp <= this.lastSegTimestamp) {
			this.lastSegTimestamp += 1;
		} else {
			this.lastSegTimestamp = timestamp;
		}

		try {
			const result = this.imageSegmenter.segmentForVideo(
				videoFrame,
				this.lastSegTimestamp,
			);
			if (
				!result.confidenceMasks ||
				result.confidenceMasks.length === 0
			) {
				return null;
			}
			// The selfie segmenter outputs a single confidence mask
			const mask = result.confidenceMasks[0];
			return mask.getAsFloat32Array();
		} catch (error) {
			console.warn("[SegmentationService] Segmentation error:", error);
			return null;
		}
	}

	/**
	 * Releases all model resources.
	 */
	dispose(): void {
		if (this.faceLandmarker) {
			this.faceLandmarker.close();
			this.faceLandmarker = null;
		}
		if (this.imageSegmenter) {
			this.imageSegmenter.close();
			this.imageSegmenter = null;
		}
		this._isInitialized = false;
		this.lastFaceTimestamp = -1;
		this.lastSegTimestamp = -1;
	}

	isReady(): boolean {
		return this._isInitialized;
	}
}

/** Singleton instance for use across the application */
export const segmentationService = new SegmentationService();
