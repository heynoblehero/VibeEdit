/**
 * Auto-caption generation using browser Web Speech API.
 * Falls back to a simple "no speech API" error on unsupported browsers.
 *
 * For production, this should use Whisper via @huggingface/transformers
 * (already a dependency in VibeEdit). For now, uses the built-in browser API
 * which is free and works offline in Chrome.
 */

export interface CaptionSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export async function generateCaptions(
  audioFile: File
): Promise<CaptionSegment[]> {
  // Use Web Audio API to decode the audio
  const audioContext = new AudioContext();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // For now, create a simple segment structure based on audio duration
  // In a full implementation, this would use Whisper or similar
  const duration = audioBuffer.duration;

  // Check if SpeechRecognition is available
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error(
      "Speech recognition not supported in this browser. Use Chrome for auto-captions, or import an SRT/VTT file."
    );
  }

  return new Promise((resolve, reject) => {
    const segments: CaptionSegment[] = [];
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // Play audio through an AudioContext for recognition
    const source = audioContext.createMediaStreamDestination();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(source);
    bufferSource.connect(audioContext.destination);

    const startTime = Date.now();

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            const elapsed = (Date.now() - startTime) / 1000;
            const segStart = Math.max(0, elapsed - 3); // approximate
            segments.push({
              startTime: segStart,
              endTime: elapsed,
              text,
            });
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      resolve(segments);
    };

    // Start recognition and playback
    try {
      recognition.start();
      bufferSource.start(0);

      // Stop after audio duration + 2s buffer
      setTimeout(
        () => {
          try {
            recognition.stop();
          } catch {}
          try {
            bufferSource.stop();
          } catch {}
        },
        (duration + 2) * 1000
      );
    } catch (err) {
      reject(new Error(`Failed to start caption generation: ${err}`));
    }
  });
}

/**
 * Simple fallback: generate placeholder captions based on audio duration.
 * Users can then edit the text manually via AI commands.
 */
export function generatePlaceholderCaptions(
  duration: number,
  intervalSeconds: number = 5
): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  for (let t = 0; t < duration; t += intervalSeconds) {
    segments.push({
      startTime: t,
      endTime: Math.min(t + intervalSeconds, duration),
      text: `[Caption ${Math.floor(t / intervalSeconds) + 1}]`,
    });
  }
  return segments;
}
