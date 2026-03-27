/**
 * Lottie animation utilities.
 * Validates and parses Lottie JSON files.
 */

export interface LottieMetadata {
  name: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  duration: number; // seconds
}

export function parseLottieJSON(jsonString: string): { valid: boolean; metadata?: LottieMetadata; error?: string } {
  try {
    const data = JSON.parse(jsonString);

    // Basic Lottie validation
    if (!data.w || !data.h || !data.fr || !data.op) {
      return { valid: false, error: "Not a valid Lottie file: missing w, h, fr, or op" };
    }

    return {
      valid: true,
      metadata: {
        name: data.nm || "Untitled Animation",
        width: data.w,
        height: data.h,
        fps: data.fr,
        totalFrames: data.op - (data.ip || 0),
        duration: (data.op - (data.ip || 0)) / data.fr,
      },
    };
  } catch {
    return { valid: false, error: "Invalid JSON" };
  }
}

// Store for Lottie animation data
const lottieStore = new Map<string, object>();

export function registerLottie(id: string, data: object): void {
  lottieStore.set(id, data);
}

export function getLottieData(id: string): object | undefined {
  return lottieStore.get(id);
}

export function getAllLotties(): string[] {
  return Array.from(lottieStore.keys());
}
