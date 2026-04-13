/**
 * Audio silence detection for auto-jump-cut.
 * Analyzes audio data to find silent segments that can be removed.
 */

export interface SilentSegment {
	start: number;
	end: number;
	duration: number;
}

export interface SilenceDetectionResult {
	silentSegments: SilentSegment[];
	speechSegments: SilentSegment[];
	totalSilence: number;
	totalSpeech: number;
}

/**
 * Detect silent segments in audio data.
 * @param audioData - Float32Array of audio samples (mono)
 * @param sampleRate - Audio sample rate (e.g. 44100)
 * @param thresholdDb - Silence threshold in dB (default -40)
 * @param minSilenceDuration - Minimum silence duration in seconds (default 0.5)
 * @param padding - Keep this many seconds before/after speech (default 0.1)
 */
export function detectSilence(
	audioData: Float32Array,
	sampleRate: number,
	thresholdDb = -40,
	minSilenceDuration = 0.5,
	padding = 0.1,
): SilenceDetectionResult {
	const thresholdLinear = Math.pow(10, thresholdDb / 20);
	const windowSize = Math.floor(sampleRate * 0.02); // 20ms analysis window
	const hopSize = Math.floor(windowSize / 2);
	const minSilenceSamples = Math.floor(minSilenceDuration * sampleRate);
	const paddingSamples = Math.floor(padding * sampleRate);

	// Calculate RMS energy for each window
	const energyFrames: boolean[] = []; // true = speech, false = silence
	for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
		let rms = 0;
		for (let j = 0; j < windowSize; j++) {
			const sample = audioData[i + j];
			rms += sample * sample;
		}
		rms = Math.sqrt(rms / windowSize);
		energyFrames.push(rms > thresholdLinear);
	}

	// Find contiguous silent/speech regions
	const silentSegments: SilentSegment[] = [];
	const speechSegments: SilentSegment[] = [];
	let segStart = 0;
	let isSpeech = energyFrames[0];

	for (let i = 1; i <= energyFrames.length; i++) {
		const current = i < energyFrames.length ? energyFrames[i] : !isSpeech;
		if (current !== isSpeech) {
			const startSec = (segStart * hopSize) / sampleRate;
			const endSec = (i * hopSize) / sampleRate;
			const duration = endSec - startSec;

			if (isSpeech) {
				speechSegments.push({ start: startSec, end: endSec, duration });
			} else if (duration >= minSilenceDuration) {
				// Apply padding: shrink silence to keep some space around speech
				const paddedStart = startSec + padding;
				const paddedEnd = endSec - padding;
				if (paddedEnd > paddedStart) {
					silentSegments.push({
						start: paddedStart,
						end: paddedEnd,
						duration: paddedEnd - paddedStart,
					});
				}
			}

			segStart = i;
			isSpeech = current;
		}
	}

	const totalSilence = silentSegments.reduce((sum, s) => sum + s.duration, 0);
	const totalSpeech = speechSegments.reduce((sum, s) => sum + s.duration, 0);

	return { silentSegments, speechSegments, totalSilence, totalSpeech };
}
