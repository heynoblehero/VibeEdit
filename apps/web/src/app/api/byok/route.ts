import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import type { ProviderId } from "@/lib/api-keys/store";
import { isApiKeysSecretConfigured } from "@/lib/api-keys/crypto";
import { clearStoredApiKey, listStoredKeyMeta, setStoredApiKey } from "@/lib/api-keys/server-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side BYOK key management. Keys are encrypted at rest (AES-256-GCM,
// API_KEYS_SECRET) and only ever returned to the client masked (last 4 chars).
// This is the cross-device alternative to the browser-local localStorage store.
const ALLOWED_PROVIDERS: ProviderId[] = ["replicate", "elevenlabs", "openai", "anthropic"];

// GET — list the caller's stored keys as masked metadata. Never returns full keys.
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const keys = listStoredKeyMeta(session.user.id);
  return NextResponse.json({
    secretConfigured: isApiKeysSecretConfigured(),
    keys,
  });
}

// PUT — store/replace one provider key (encrypted at rest).
export async function PUT(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  if (!isApiKeysSecretConfigured()) {
    return new NextResponse("server-side key storage is not configured", { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    apiKey?: string;
  };
  const provider = body.provider as ProviderId | undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return new NextResponse("invalid provider", { status: 400 });
  }
  if (!apiKey) return new NextResponse("apiKey required", { status: 400 });

  setStoredApiKey(session.user.id, provider, apiKey);
  const meta = listStoredKeyMeta(session.user.id).find((k) => k.provider === provider);
  return NextResponse.json({ ok: true, key: meta });
}

// DELETE — remove one provider key. Provider passed as ?provider= query param.
export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;

  const provider = new URL(req.url).searchParams.get("provider") as ProviderId | null;
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return new NextResponse("invalid provider", { status: 400 });
  }
  clearStoredApiKey(session.user.id, provider);
  return NextResponse.json({ ok: true });
}
