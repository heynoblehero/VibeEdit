import { NextRequest, NextResponse } from "next/server";
import { generateMedia, TRUSTED_SERVICES, type TrustedServiceId } from "@/lib/ai/services";
import { getApiKey } from "@/lib/ai/key-store";
import { logSecurity } from "@/lib/ai/security-log";
import { deductCredits, hasEnoughCredits } from "@/lib/credits";
import { getCreditCost } from "@/lib/credits/costs";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // CSRF protection: verify request comes from our own origin
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || "localhost:3001";
    const allowedOrigin = `http://${host}`;
    const allowedOriginHttps = `https://${host}`;

    if (origin && origin !== allowedOrigin && origin !== allowedOriginHttps) {
      logSecurity("error", "csrf_blocked", { ip, origin, endpoint: "/api/ai/generate" });
      return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
    }

    if (!checkRateLimit(ip)) {
      logSecurity("warn", "rate_limit_hit", { ip, endpoint: "/api/ai/generate" });
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 5 generation requests per minute." },
        { status: 429 }
      );
    }

    const userId = "anonymous"; // TODO: get from auth session

    const body = await request.json();
    const { service, action, params } = body;

    const costKey = `generate_media_${service}`;
    const cost = getCreditCost(costKey);
    if (cost > 0) {
      const hasCredits = await hasEnoughCredits(userId, cost);
      if (!hasCredits) {
        return NextResponse.json({ error: "No credits remaining." }, { status: 402 });
      }
    }

    const apiKey = getApiKey(service);

    if (!service || !action) {
      return NextResponse.json(
        { error: "service and action are required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for ${service}. Set it via the settings.` },
        { status: 400 }
      );
    }

    // Security: reject untrusted services at the API boundary
    if (!(service in TRUSTED_SERVICES)) {
      logSecurity("warn", "untrusted_service_attempt", { ip, service, endpoint: "/api/ai/generate" });
      return NextResponse.json(
        {
          error: `Service "${service}" is not trusted. Allowed services: ${Object.keys(TRUSTED_SERVICES).join(", ")}`,
        },
        { status: 403 }
      );
    }

    const svc = TRUSTED_SERVICES[service as TrustedServiceId];
    if (!svc.actions.includes(action)) {
      return NextResponse.json(
        {
          error: `Action "${action}" is not allowed for ${svc.name}. Allowed: ${svc.actions.join(", ") || "none"}`,
        },
        { status: 403 }
      );
    }

    const result = await generateMedia({
      service: service as TrustedServiceId,
      action,
      params: params || {},
      apiKey,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    logSecurity("info", "media_generated", { ip, service, action });

    if (cost > 0) {
      await deductCredits(userId, cost, costKey, `Generated ${service} media`);
    }

    return new NextResponse(result.data, {
      headers: {
        "Content-Type": result.mimeType || "application/octet-stream",
        "X-Filename": result.filename || "generated_media",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
