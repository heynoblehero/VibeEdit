import {
	AutoModel,
	AutoProcessor,
	env,
	RawImage,
	type Processor,
	type PreTrainedModel,
} from "@huggingface/transformers";

export type WorkerMessage =
	| { type: "init" }
	| { type: "segment"; imageData: ImageData; width: number; height: number }
	| { type: "dispose" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| { type: "segment-result"; mask: Uint8ClampedArray; width: number; height: number }
	| { type: "segment-error"; error: string };

let model: PreTrainedModel | null = null;
let processor: Processor | null = null;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

// Disable local model checks — always fetch from HuggingFace Hub
env.allowLocalModels = false;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	switch (message.type) {
		case "init":
			await handleInit();
			break;
		case "segment":
			await handleSegment({
				imageData: message.imageData,
				width: message.width,
				height: message.height,
			});
			break;
		case "dispose":
			handleDispose();
			break;
	}
};

async function handleInit() {
	lastReportedProgress = -1;
	fileBytes.clear();

	try {
		const progressCallback = (progressInfo: {
			status?: string;
			file?: string;
			loaded?: number;
			total?: number;
		}) => {
			const file = progressInfo.file;
			if (!file) return;

			const loaded = progressInfo.loaded ?? 0;
			const total = progressInfo.total ?? 0;

			if (progressInfo.status === "progress" && total > 0) {
				fileBytes.set(file, { loaded, total });
			} else if (progressInfo.status === "done") {
				const existing = fileBytes.get(file);
				if (existing) {
					fileBytes.set(file, {
						loaded: existing.total,
						total: existing.total,
					});
				}
			}

			// sum all bytes
			let totalLoaded = 0;
			let totalSize = 0;
			for (const { loaded, total } of fileBytes.values()) {
				totalLoaded += loaded;
				totalSize += total;
			}

			if (totalSize === 0) return;

			const overallProgress = (totalLoaded / totalSize) * 100;
			const roundedProgress = Math.floor(overallProgress);

			if (roundedProgress !== lastReportedProgress) {
				lastReportedProgress = roundedProgress;
				self.postMessage({
					type: "init-progress",
					progress: roundedProgress,
				} satisfies WorkerResponse);
			}
		};

		const modelId = "briaai/RMBG-1.4";

		// Load model and processor in parallel
		const [loadedModel, loadedProcessor] = await Promise.all([
			AutoModel.from_pretrained(modelId, {
				device: "webgpu",
				progress_callback: progressCallback,
			}).catch(() =>
				// Fallback to WASM if WebGPU is not available
				AutoModel.from_pretrained(modelId, {
					device: "wasm",
					progress_callback: progressCallback,
				}),
			),
			AutoProcessor.from_pretrained(modelId, {
				progress_callback: progressCallback,
			}),
		]);

		model = loadedModel;
		processor = loadedProcessor;

		self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
	} catch (error) {
		self.postMessage({
			type: "init-error",
			error: error instanceof Error ? error.message : "Failed to load RMBG-1.4 model",
		} satisfies WorkerResponse);
	}
}

async function handleSegment({
	imageData,
	width,
	height,
}: {
	imageData: ImageData;
	width: number;
	height: number;
}) {
	if (!model || !processor) {
		self.postMessage({
			type: "segment-error",
			error: "Model not initialized",
		} satisfies WorkerResponse);
		return;
	}

	try {
		// Convert ImageData to RawImage (RGBA -> RGB)
		const rawImage = new RawImage(imageData.data, width, height, 4);

		// Process the image through the RMBG processor
		const { pixel_values } = await processor(rawImage);

		// Run inference
		const { output } = await model({ input: pixel_values });

		// The output is a tensor — resize it to the original image dimensions
		// output shape is [1, 1, H, W] with values in [0, 1]
		const maskTensor = output[0]; // remove batch dim if present
		const resultData = maskTensor.data as Float32Array;

		// Get the model output dimensions
		const outputHeight = maskTensor.dims[maskTensor.dims.length - 2];
		const outputWidth = maskTensor.dims[maskTensor.dims.length - 1];

		// Create the final mask at the original resolution using bilinear interpolation
		const mask = new Uint8ClampedArray(width * height);
		const scaleX = outputWidth / width;
		const scaleY = outputHeight / height;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				// Map to source coordinates
				const srcX = x * scaleX;
				const srcY = y * scaleY;

				// Bilinear interpolation
				const x0 = Math.floor(srcX);
				const y0 = Math.floor(srcY);
				const x1 = Math.min(x0 + 1, outputWidth - 1);
				const y1 = Math.min(y0 + 1, outputHeight - 1);
				const dx = srcX - x0;
				const dy = srcY - y0;

				const v00 = resultData[y0 * outputWidth + x0];
				const v10 = resultData[y0 * outputWidth + x1];
				const v01 = resultData[y1 * outputWidth + x0];
				const v11 = resultData[y1 * outputWidth + x1];

				const value =
					v00 * (1 - dx) * (1 - dy) +
					v10 * dx * (1 - dy) +
					v01 * (1 - dx) * dy +
					v11 * dx * dy;

				// Convert to 0-255 range: 255 = person (foreground), 0 = background
				mask[y * width + x] = Math.round(Math.max(0, Math.min(1, value)) * 255);
			}
		}

		// Morphological cleanup: dilate then erode to close small gaps (hair fringing fix)
		const cleaned = morphCleanup(mask, width, height);

		const response: WorkerResponse = {
			type: "segment-result",
			mask: cleaned,
			width,
			height,
		};
		// Transfer the mask buffer for zero-copy performance
		self.postMessage(response, { transfer: [cleaned.buffer] });
	} catch (error) {
		self.postMessage({
			type: "segment-error",
			error: error instanceof Error ? error.message : "Segmentation failed",
		} satisfies WorkerResponse);
	}
}

/**
 * Morphological cleanup: dilate then erode (close operation)
 * Fixes hair fringing and small mask gaps along edges.
 */
function morphCleanup(mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
	const radius = 2;
	const temp = new Uint8ClampedArray(w * h);
	const out = new Uint8ClampedArray(w * h);

	// Dilate: expand foreground (fills small gaps in hair)
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let maxVal = 0;
			for (let dy = -radius; dy <= radius; dy++) {
				for (let dx = -radius; dx <= radius; dx++) {
					const nx = Math.min(w - 1, Math.max(0, x + dx));
					const ny = Math.min(h - 1, Math.max(0, y + dy));
					maxVal = Math.max(maxVal, mask[ny * w + nx]);
				}
			}
			temp[y * w + x] = maxVal;
		}
	}

	// Erode: shrink back to original size (removes expansion outside person)
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let minVal = 255;
			for (let dy = -radius; dy <= radius; dy++) {
				for (let dx = -radius; dx <= radius; dx++) {
					const nx = Math.min(w - 1, Math.max(0, x + dx));
					const ny = Math.min(h - 1, Math.max(0, y + dy));
					minVal = Math.min(minVal, temp[ny * w + nx]);
				}
			}
			out[y * w + x] = minVal;
		}
	}

	return out;
}

function handleDispose() {
	model = null;
	processor = null;
}
