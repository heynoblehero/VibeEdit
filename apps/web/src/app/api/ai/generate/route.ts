import { NextRequest, NextResponse } from "next/server";
import { generateMedia, TRUSTED_SERVICES, type TrustedServiceId } from "@/lib/ai/services";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, action, params, apiKey } = body;

    if (!service || !action || !apiKey) {
      return NextResponse.json(
        { error: "service, action, and apiKey are required" },
        { status: 400 }
      );
    }

    // Security: reject untrusted services at the API boundary
    if (!(service in TRUSTED_SERVICES)) {
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

    return new NextResponse(result.data, {
      headers: {
        "Content-Type": result.mimeType || "application/octet-stream",
        "X-Filename": result.filename || "generated_media",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
