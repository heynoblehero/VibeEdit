/**
 * Silence detection and trimming utilities for AudioBuffer data.
 *
 * Scans audio for regions where amplitude stays below a dB threshold
 * for at least a minimum duration, then can trim those regions out.
 */

export interface SilentRegion {
	/** Start time in seconds */
	startTime: number;
	/** End time in seconds */
	endTime: number;
	/** Duration in seconds */
	duration: number;
}

export interface DetectSilentRegionsParams {
	audioBuffer: AudioBuffer;
	/** Amplitude threshold in dB (e.g. -40). Samples below this are "silent". */
	thresholdDb: number;
	/** Minimum duration in seconds for a region to count as silence (e.g. 0.5). */
	minSilenceDuration: number;
}

export interface TrimSilenceParams {
	audioBuffer: AudioBuffer;
	regions: SilentRegion[];
	audioContext: AudioContext | OfflineAudioContext;
}

/**
 * Convert a dB threshold to a linear amplitude value.
 * dB = 20 * log10(amplitude), so amplitude = 10^(dB/20)
 */
function dbToLinear(db: number): number {
	return Math.pow(10, db / 20);
}

/**
 * Compute the RMS amplitude of a block of samples.
 */
function rms(samples: Float32Array, start: number, end: number): number {
	let sum = 0;
	const count = end - start;
	if (count <= 0) return 0;
	for (let i = start; i < end; i++) {
		sum += samples[i] * samples[i];
	}
	return Math.sqrt(sum / count);
}

/**
 * Detect contiguous silent regions in an AudioBuffer.
 *
 * Analyses in small blocks (10ms windows). A block is "silent" if its
 * RMS amplitude across all channels is below the threshold. Contiguous
 * silent blocks that meet the minimum duration form a SilentRegion.
 */
export function detectSilentRegions({
	audioBuffer,
	thresholdDb,
	minSilenceDuration,
}: DetectSilentRegionsParams): SilentRegion[] {
	const sampleRate = audioBuffer.sampleRate;
	const totalSamples = audioBuffer.length;
	const numChannels = audioBuffer.numberOfChannels;
	const linearThreshold = dbToLinear(thresholdDb);

	// Analysis window: 10ms blocks
	const blockSize = Math.max(1, Math.floor(sampleRate * 0.01));

	// Extract channel data
	const channels: Float32Array[] = [];
	for (let ch = 0; ch < numChannels; ch++) {
		channels.push(audioBuffer.getChannelData(ch));
	}

	const regions: SilentRegion[] = [];
	let silenceStartSample: number | null = null;

	for (let blockStart = 0; blockStart < totalSamples; blockStart += blockSize) {
		const blockEnd = Math.min(blockStart + blockSize, totalSamples);

		// Compute max RMS across all channels for this block
		let maxRms = 0;
		for (let ch = 0; ch < numChannels; ch++) {
			const channelRms = rms(channels[ch], blockStart, blockEnd);
			if (channelRms > maxRms) {
				maxRms = channelRms;
			}
		}

		const isSilent = maxRms < linearThreshold;

		if (isSilent) {
			if (silenceStartSample === null) {
				silenceStartSample = blockStart;
			}
		} else {
			if (silenceStartSample !== null) {
				const startTime = silenceStartSample / sampleRate;
				const endTime = blockStart / sampleRate;
				const duration = endTime - startTime;
				if (duration >= minSilenceDuration) {
					regions.push({ startTime, endTime, duration });
				}
				silenceStartSample = null;
			}
		}
	}

	// Handle silence that extends to the end of the buffer
	if (silenceStartSample !== null) {
		const startTime = silenceStartSample / sampleRate;
		const endTime = totalSamples / sampleRate;
		const duration = endTime - startTime;
		if (duration >= minSilenceDuration) {
			regions.push({ startTime, endTime, duration });
		}
	}

	return regions;
}

/**
 * Trim silent regions from an AudioBuffer, returning a new AudioBuffer
 * with those regions removed.
 *
 * Regions are removed in order; the remaining audio segments are
 * concatenated. Small crossfades (5ms) are applied at splice points
 * to avoid clicks.
 */
export function trimSilence({
	audioBuffer,
	regions,
	audioContext,
}: TrimSilenceParams): AudioBuffer {
	if (regions.length === 0) {
		return audioBuffer;
	}

	const sampleRate = audioBuffer.sampleRate;
	const numChannels = audioBuffer.numberOfChannels;
	const totalSamples = audioBuffer.length;

	// Sort regions by start time
	const sorted = [...regions].sort((a, b) => a.startTime - b.startTime);

	// Build list of "keep" segments (non-silent ranges in samples)
	const keepSegments: Array<{ start: number; end: number }> = [];
	let cursor = 0;

	for (const region of sorted) {
		const silenceStart = Math.floor(region.startTime * sampleRate);
		const silenceEnd = Math.min(
			Math.ceil(region.endTime * sampleRate),
			totalSamples,
		);

		if (silenceStart > cursor) {
			keepSegments.push({ start: cursor, end: silenceStart });
		}
		cursor = silenceEnd;
	}

	// Keep anything after the last silent region
	if (cursor < totalSamples) {
		keepSegments.push({ start: cursor, end: totalSamples });
	}

	if (keepSegments.length === 0) {
		// Everything was silence — return a minimal empty buffer
		return audioContext.createBuffer(numChannels, 1, sampleRate);
	}

	// Compute output length
	const outputLength = keepSegments.reduce(
		(sum, seg) => sum + (seg.end - seg.start),
		0,
	);

	const output = audioContext.createBuffer(numChannels, outputLength, sampleRate);

	// Crossfade duration: 5ms worth of samples
	const fadeSamples = Math.min(Math.floor(sampleRate * 0.005), 256);

	for (let ch = 0; ch < numChannels; ch++) {
		const inputData = audioBuffer.getChannelData(ch);
		const outputData = output.getChannelData(ch);
		let writePos = 0;

		for (let segIdx = 0; segIdx < keepSegments.length; segIdx++) {
			const seg = keepSegments[segIdx];
			const segLength = seg.end - seg.start;

			// Copy segment
			for (let i = 0; i < segLength; i++) {
				outputData[writePos + i] = inputData[seg.start + i];
			}

			// Apply fade-in at start of segment (except first segment)
			if (segIdx > 0) {
				const fadeLen = Math.min(fadeSamples, segLength);
				for (let i = 0; i < fadeLen; i++) {
					const gain = i / fadeLen;
					outputData[writePos + i] *= gain;
				}
			}

			// Apply fade-out at end of segment (except last segment)
			if (segIdx < keepSegments.length - 1) {
				const fadeLen = Math.min(fadeSamples, segLength);
				for (let i = 0; i < fadeLen; i++) {
					const idx = writePos + segLength - fadeLen + i;
					const gain = 1 - i / fadeLen;
					outputData[idx] *= gain;
				}
			}

			writePos += segLength;
		}
	}

	return output;
}
