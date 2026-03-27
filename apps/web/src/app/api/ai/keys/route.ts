import { NextRequest, NextResponse } from "next/server";
import { setApiKey, hasApiKey, listConfiguredServices, clearApiKey } from "@/lib/ai/key-store";
import { TRUSTED_SERVICES, type TrustedServiceId } from "@/lib/ai/services";
import { logSecurity } from "@/lib/ai/security-log";

// CSRF protection helper
function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "localhost:3001";
  const allowedOrigin = `http://${host}`;
  const allowedOriginHttps = `https://${host}`;

  if (origin && origin !== allowedOrigin && origin !== allowedOriginHttps) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    logSecurity("error", "csrf_blocked", { ip, origin, endpoint: "/api/ai/keys" });
    return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
  }
  return null;
}

// POST: Set an API key for a service
export async function POST(request: NextRequest) {
  const csrfError = validateOrigin(request);
  if (csrfError) return csrfError;

  const body = await request.json();
  const { service, apiKey } = body;

  if (!service || typeof service !== "string") {
    return NextResponse.json({ error: "service is required" }, { status: 400 });
  }
  if (!(service in TRUSTED_SERVICES)) {
    return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 256) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
  }

  setApiKey(service, apiKey);
  logSecurity("info", "api_key_configured", { service });
  return NextResponse.json({ success: true, service, configured: true });
}

// GET: List which services have keys configured (never expose the actual keys)
export async function GET() {
  const configured = listConfiguredServices();
  const services = Object.keys(TRUSTED_SERVICES).map(id => ({
    id,
    name: TRUSTED_SERVICES[id as TrustedServiceId].name,
    configured: configured.includes(id),
  }));
  return NextResponse.json({ services });
}

// DELETE: Remove an API key
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  if (service) {
    clearApiKey(service);
    logSecurity("info", "api_key_removed", { service });
  }
  return NextResponse.json({ success: true });
}
