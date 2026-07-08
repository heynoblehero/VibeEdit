// Admin-facing "how to set this up" guidance, shown in the Providers console
// next to the add-credential form. Keyed by the managed provider id
// (MANAGED_PROVIDERS in lib/ai/models.ts). Pure data — safe to import client-side.

export interface ProviderSetupGuide {
  /** One-line what this provider powers in the product. */
  powers: string;
  /** What to paste into the "secret" field. */
  secretHint: string;
  /** For proxy providers: what the endpoint URL should be. */
  endpointHint?: string;
  /** Ordered setup steps. */
  steps: string[];
  /** Where to get it / read more. */
  docsUrl?: string;
  /** Unofficial/ToS-risk providers get a warning banner. */
  warning?: string;
}

export const PROVIDER_SETUP: Record<string, ProviderSetupGuide> = {
  elevenlabs: {
    powers: "Voiceovers (TTS) and speech-to-text transcription.",
    secretHint: "The API key (starts with `sk_…`).",
    docsUrl: "https://elevenlabs.io/app/settings/api-keys",
    steps: [
      "Sign in at elevenlabs.io.",
      "Click your avatar (top-right) → “API Keys”.",
      "Create a new key and copy it.",
      "Paste it into the API key field below and Add. Add multiple keys to raise throughput — the pool rotates across them.",
    ],
  },
  replicate: {
    powers:
      "Image + video + music generation — FLUX, Ideogram, Kling, Luma, Riffusion ALL run on this ONE token.",
    secretHint: "The API token (starts with `r8_…`).",
    docsUrl: "https://replicate.com/account/api-tokens",
    steps: [
      "Sign in at replicate.com and add billing (pay-as-you-go).",
      "Go to Account → API tokens.",
      "Create a token and copy it.",
      "Paste it below. You do NOT need separate Luma/Kling keys — they go through this token.",
    ],
  },
  anthropic: {
    powers: "The agent “brain” (Vibe / Vibe Max) and image vision/captioning.",
    secretHint: "The API key (starts with `sk-ant-…`).",
    docsUrl: "https://console.anthropic.com/settings/keys",
    steps: [
      "Sign in at console.anthropic.com and add billing.",
      "Settings → API Keys → Create Key, then copy it.",
      "Paste it below. (If you front the API with a proxy, also set the ANTHROPIC_BASE_URL env var.)",
    ],
  },
  runway: {
    powers: "Runway Gen-3 text/image-to-video.",
    secretHint: "Your Runway API key.",
    docsUrl: "https://dev.runwayml.com",
    steps: [
      "Create a Runway account with API access at dev.runwayml.com.",
      "Generate an API key in the developer dashboard.",
      "Paste it below.",
    ],
  },
  pika: {
    powers: "Pika text-to-video.",
    secretHint: "Your Pika API key.",
    docsUrl: "https://pika.art",
    steps: [
      "Request Pika API access (currently invite/waitlist).",
      "Copy the API key from your Pika developer settings.",
      "Paste it below.",
    ],
  },
  midjourney: {
    powers: "Midjourney image generation (stylized/illustrative look).",
    secretHint: "The `mj-api-secret` you configured on your proxy.",
    endpointHint:
      "The base URL of your self-hosted midjourney-proxy (e.g. https://mj.example.com).",
    docsUrl: "https://github.com/novelzk/midjourney-proxy",
    warning:
      "Unofficial — Midjourney has NO public API. This needs a self-hosted relay wired to a PAID Midjourney account via Discord. Carries Terms-of-Service risk.",
    steps: [
      "Get a paid Midjourney subscription and a Discord account in your MJ server.",
      "Deploy novelzk/midjourney-proxy (Docker) and connect it to your Discord/MJ account.",
      "Set an `mj-api-secret` in the proxy config.",
      "Proxy URL = your proxy's base URL; Secret / cookie = the `mj-api-secret`. Then Add.",
    ],
  },
  suno: {
    powers: "Suno music generation.",
    secretHint: "Your suno.com account session cookie.",
    endpointHint: "The base URL of your self-hosted suno-api relay.",
    docsUrl: "https://github.com/gcui-art/suno-api",
    warning: "Unofficial — self-hosted relay using your account cookie. Terms-of-Service risk.",
    steps: [
      "Deploy gcui-art/suno-api (Docker/Vercel).",
      "Log into suno.com and copy your session cookie into the relay's config.",
      "Proxy URL = the relay base URL; Secret / cookie = the account cookie. Then Add.",
    ],
  },
  udio: {
    powers: "Udio music generation.",
    secretHint: "Your udio.com account session cookie.",
    endpointHint: "The base URL of your self-hosted Udio relay.",
    warning: "Unofficial — self-hosted relay using your account cookie. Terms-of-Service risk.",
    steps: [
      "Deploy a Udio relay (same pattern as Suno).",
      "Log into udio.com and copy your session cookie into the relay.",
      "Proxy URL = the relay base URL; Secret / cookie = the account cookie. Then Add.",
    ],
  },
  viggle: {
    powers: "Viggle character animation / pose transfer (motion).",
    secretHint: "Your Viggle account token.",
    endpointHint: "The base URL of your self-hosted Viggle relay.",
    warning: "Unofficial — self-hosted relay. Terms-of-Service risk.",
    steps: [
      "Deploy a Viggle relay.",
      "Get your Viggle account token and set it in the relay.",
      "Proxy URL = the relay base URL; Secret / cookie = the token. Then Add.",
    ],
  },
  grok2api: {
    powers: "Grok as a brain fallback via the archived grok2api relay.",
    secretHint: "Your x.ai / Grok cookie or token.",
    endpointHint: "The base URL of your self-hosted grok2api relay.",
    warning:
      "Unofficial — the grok2api project is archived. Prefer the official Grok API (XAI_API_KEY env) where possible.",
    steps: [
      "Deploy the grok2api relay.",
      "Provide your Grok cookie/token to the relay.",
      "Proxy URL = the relay base URL; Secret / cookie = the token. Then Add.",
    ],
  },
};
