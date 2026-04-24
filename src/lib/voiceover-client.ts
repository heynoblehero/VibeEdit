import { useVoiceStore } from "@/store/voice-store";

export interface VoiceoverResult {
  audioUrl: string;
  audioDurationSec: number;
  voice: string;
  provider: "openai" | "elevenlabs";
}

/**
 * Makes a TTS request using whatever voice is currently active in the store.
 * Cloned ElevenLabs voices route via elevenLabsVoiceId; OpenAI voices pass
 * `voice` as the preset name.
 */
export async function ttsWithActiveVoice(text: string): Promise<VoiceoverResult> {
  const active = useVoiceStore.getState().activeVoice;
  const body =
    active.kind === "elevenlabs"
      ? { text, elevenLabsVoiceId: active.id }
      : { text, voice: active.id };
  const res = await fetch("/api/voiceover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `voiceover failed (${res.status})`);
  return {
    audioUrl: data.audioUrl,
    audioDurationSec: data.audioDurationSec,
    voice: active.id,
    provider: active.kind,
  };
}
