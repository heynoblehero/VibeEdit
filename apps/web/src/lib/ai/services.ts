// External service integrations for AI-generated media

export interface GenerateMediaParams {
  service: "elevenlabs" | "stability" | "suno";
  action: string;
  params: Record<string, unknown>;
  apiKey: string;
}

export interface GenerateMediaResult {
  success: boolean;
  data?: ArrayBuffer;
  mimeType?: string;
  filename?: string;
  error?: string;
}

// ElevenLabs TTS
async function elevenLabsTTS(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const text = params.text as string;
  const voiceId = (params.voiceId as string) || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
  const modelId = (params.modelId as string) || "eleven_monolingual_v1";

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: (params.stability as number) ?? 0.5,
        similarity_boost: (params.similarityBoost as number) ?? 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `ElevenLabs API error (${response.status}): ${errorText}` };
  }

  const data = await response.arrayBuffer();
  const sanitizedText = text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
  return {
    success: true,
    data,
    mimeType: "audio/mpeg",
    filename: `elevenlabs_${sanitizedText}.mp3`,
  };
}

// Stability AI Image Generation
async function stabilityImage(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const prompt = params.prompt as string;

  const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "image/*",
    },
    body: (() => {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("output_format", "png");
      if (params.width) form.append("width", String(params.width));
      if (params.height) form.append("height", String(params.height));
      return form;
    })(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Stability API error (${response.status}): ${errorText}` };
  }

  const data = await response.arrayBuffer();
  const sanitizedPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
  return {
    success: true,
    data,
    mimeType: "image/png",
    filename: `generated_${sanitizedPrompt}.png`,
  };
}

export async function generateMedia(params: GenerateMediaParams): Promise<GenerateMediaResult> {
  const { service, action, params: serviceParams, apiKey } = params;

  switch (service) {
    case "elevenlabs":
      if (action === "tts") return elevenLabsTTS(serviceParams, apiKey);
      return { success: false, error: `Unknown ElevenLabs action: ${action}` };

    case "stability":
      if (action === "generate") return stabilityImage(serviceParams, apiKey);
      return { success: false, error: `Unknown Stability action: ${action}` };

    case "suno":
      return { success: false, error: "Suno integration coming soon" };

    default:
      return { success: false, error: `Unknown service: ${service}` };
  }
}
