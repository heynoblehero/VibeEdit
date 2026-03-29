/**
 * Audio noise suppression chain using Web Audio API filters.
 *
 * Chain: high-pass → 50Hz notch → 60Hz notch → compressor → low-pass → analyser
 *
 * Strength (0-100) controls how aggressively filters cut:
 * - High-pass cutoff: 80Hz (gentle) to 200Hz (aggressive)
 * - Low-pass cutoff: 12000Hz (gentle) to 8000Hz (aggressive)
 * - Compressor threshold scales with strength
 */

export interface NoiseSuppressionParams {
	audioContext: AudioContext;
	sourceNode: AudioNode;
	strength: number;
}

export interface NoiseSuppressionChain {
	output: AudioNode;
	analyser: AnalyserNode;
	dispose: () => void;
}

export function createNoiseSuppressionChain({
	audioContext,
	sourceNode,
	strength,
}: NoiseSuppressionParams): NoiseSuppressionChain {
	const t = Math.max(0, Math.min(100, strength)) / 100;

	// --- High-pass filter: remove low-frequency rumble ---
	// Cutoff interpolates from 80Hz (t=0) to 200Hz (t=1)
	const highPass = audioContext.createBiquadFilter();
	highPass.type = "highpass";
	highPass.frequency.value = 80 + t * 120;
	highPass.Q.value = 0.7;

	// --- 50Hz notch: remove mains hum (EU/Asia) ---
	const notch50 = audioContext.createBiquadFilter();
	notch50.type = "notch";
	notch50.frequency.value = 50;
	notch50.Q.value = 10 + t * 20; // narrower Q at low strength, wider cut at high

	// --- 60Hz notch: remove mains hum (US) ---
	const notch60 = audioContext.createBiquadFilter();
	notch60.type = "notch";
	notch60.frequency.value = 60;
	notch60.Q.value = 10 + t * 20;

	// --- Dynamics compressor: reduce dynamic range / gate noise ---
	const compressor = audioContext.createDynamicsCompressor();
	compressor.threshold.value = -50 + t * 30; // -50dB (gentle) to -20dB (aggressive)
	compressor.knee.value = 30 - t * 20; // softer knee at low strength
	compressor.ratio.value = 4 + t * 8; // 4:1 to 12:1
	compressor.attack.value = 0.003;
	compressor.release.value = 0.1 + t * 0.15;

	// --- Low-pass filter: remove high-frequency hiss ---
	// Cutoff interpolates from 12000Hz (t=0) to 8000Hz (t=1)
	const lowPass = audioContext.createBiquadFilter();
	lowPass.type = "lowpass";
	lowPass.frequency.value = 12000 - t * 4000;
	lowPass.Q.value = 0.7;

	// --- Analyser: for visualisation / metering ---
	const analyser = audioContext.createAnalyser();
	analyser.fftSize = 2048;
	analyser.smoothingTimeConstant = 0.8;

	// Wire the chain
	sourceNode.connect(highPass);
	highPass.connect(notch50);
	notch50.connect(notch60);
	notch60.connect(compressor);
	compressor.connect(lowPass);
	lowPass.connect(analyser);

	const nodes = [highPass, notch50, notch60, compressor, lowPass, analyser];

	function dispose(): void {
		// Disconnect all nodes in reverse order
		for (let i = nodes.length - 1; i >= 0; i--) {
			try {
				nodes[i].disconnect();
			} catch {
				// Node may already be disconnected
			}
		}
		try {
			sourceNode.disconnect(highPass);
		} catch {
			// Source may already be disconnected
		}
	}

	return {
		output: analyser,
		analyser,
		dispose,
	};
}
