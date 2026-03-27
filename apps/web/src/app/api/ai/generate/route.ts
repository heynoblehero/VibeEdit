import { NextRequest, NextResponse } from "next/server";
import { generateMedia } from "@/lib/ai/services";

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

    const result = await generateMedia({ service, action, params: params || {}, apiKey });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      );
    }

    // Return the binary data with proper content type
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
