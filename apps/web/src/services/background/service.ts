import type { WorkerMessage, WorkerResponse } from "./worker";

export class BackgroundService {
	private worker: Worker | null = null;
	private isInitialized = false;
	private isInitializing = false;
	private pendingResolve:
		| ((result: { mask: Uint8ClampedArray; width: number; height: number }) => void)
		| null = null;
	private pendingReject: ((error: Error) => void) | null = null;

	/**
	 * Initialize the RMBG-1.4 model in a Web Worker.
	 * Reports progress via callback (0-100).
	 */
	async initialize(onProgress?: (progress: number) => void): Promise<void> {
		if (this.isInitialized) return;

		if (this.isInitializing) {
			await this.waitForInit();
			return;
		}

		this.isInitializing = true;

		this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
		});

		return new Promise((resolve, reject) => {
			if (!this.worker) {
				this.isInitializing = false;
				reject(new Error("Failed to create worker"));
				return;
			}

			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;

				switch (response.type) {
					case "init-progress":
						onProgress?.(response.progress);
						break;

					case "init-complete":
						this.worker?.removeEventListener("message", handleMessage);
						this.isInitialized = true;
						this.isInitializing = false;
						this.setupMessageHandler();
						resolve();
						break;

					case "init-error":
						this.worker?.removeEventListener("message", handleMessage);
						this.isInitializing = false;
						this.dispose();
						reject(new Error(response.error));
						break;
				}
			};

			this.worker.addEventListener("message", handleMessage);

			this.worker.postMessage({
				type: "init",
			} satisfies WorkerMessage);
		});
	}

	/**
	 * Set up the persistent message handler for segment responses.
	 */
	private setupMessageHandler(): void {
		if (!this.worker) return;

		this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
			const response = event.data;

			switch (response.type) {
				case "segment-result":
					if (this.pendingResolve) {
						this.pendingResolve({
							mask: response.mask,
							width: response.width,
							height: response.height,
						});
						this.pendingResolve = null;
						this.pendingReject = null;
					}
					break;

				case "segment-error":
					if (this.pendingReject) {
						this.pendingReject(new Error(response.error));
						this.pendingResolve = null;
						this.pendingReject = null;
					}
					break;
			}
		});
	}

	/**
	 * Segment a person from the given ImageData.
	 * Returns a mask where 255 = person, 0 = background.
	 */
	async segmentPerson(
		imageData: ImageData,
	): Promise<{ mask: Uint8ClampedArray; width: number; height: number }> {
		if (!this.worker || !this.isInitialized) {
			throw new Error("BackgroundService not initialized. Call initialize() first.");
		}

		// If there's already a pending request, reject it (new frame replaces old)
		if (this.pendingReject) {
			this.pendingReject(new Error("Replaced by newer segmentation request"));
			this.pendingResolve = null;
			this.pendingReject = null;
		}

		return new Promise((resolve, reject) => {
			this.pendingResolve = resolve;
			this.pendingReject = reject;

			this.worker!.postMessage({
				type: "segment",
				imageData,
				width: imageData.width,
				height: imageData.height,
			} satisfies WorkerMessage);
		});
	}

	/**
	 * Clean up the worker and release resources.
	 */
	dispose(): void {
		if (this.worker) {
			this.worker.postMessage({ type: "dispose" } satisfies WorkerMessage);
			this.worker.terminate();
			this.worker = null;
		}
		this.isInitialized = false;
		this.isInitializing = false;
		this.pendingResolve = null;
		this.pendingReject = null;
	}

	/**
	 * Check if the model is loaded and ready for segmentation.
	 */
	isReady(): boolean {
		return this.isInitialized;
	}

	private waitForInit(): Promise<void> {
		return new Promise((resolve) => {
			const checkInit = () => {
				if (this.isInitialized) {
					resolve();
				} else if (!this.isInitializing) {
					resolve();
				} else {
					setTimeout(checkInit, 100);
				}
			};
			checkInit();
		});
	}
}

/** Singleton instance for use across the application */
export const backgroundService = new BackgroundService();
