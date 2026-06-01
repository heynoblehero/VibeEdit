import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import { probeKey } from "@/lib/api-keys/probes";
import type { ProviderId } from "@/lib/api-keys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Probe a BYOK key against the provider's auth endpoint. The key arrives in
// the POST body from the user's browser (localStorage) and is forwarded for
// this one request only — nothing is persisted. Requires an authenticated
// user so randos can't use the server as a free key-validation oracle.
const ALLOWED_PROVIDERS: ProviderId[] = [
  "replicate",
  "kling",
  "fal",
  "elevenlabs",
  "openai",
  "anthropic",
];

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    apiKey?: string;
  };
  const provider = body.provider as ProviderId | undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!provider || !ALLOWED_PROVIDERS.includes(provider))
    return new NextResponse("invalid provider", { status: 400 });
  if (!apiKey) return new NextResponse("apiKey required", { status: 400 });

  const result = await probeKey(provider, apiKey);
  return NextResponse.json(result);
}
