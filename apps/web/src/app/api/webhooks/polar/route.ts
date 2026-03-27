import { NextRequest, NextResponse } from "next/server";
import { addCredits } from "@/lib/credits";
import { CREDIT_PACKS } from "@/lib/credits/costs";
import { logSecurity } from "@/lib/ai/security-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature
    const signature = request.headers.get("x-polar-signature");
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      // TODO: verify HMAC signature in production
      // For MVP, log the event
    }

    // Handle checkout.completed event
    if (body.type === "checkout.completed" || body.type === "order.created") {
      const metadata = body.data?.metadata || {};
      const userId = metadata.userId as string;
      const packId = metadata.packId as string;

      if (!userId || !packId) {
        logSecurity("warn", "polar_webhook_missing_metadata", {
          type: body.type,
        });
        return NextResponse.json(
          { error: "Missing metadata" },
          { status: 400 },
        );
      }

      const pack = CREDIT_PACKS.find((p) => p.id === packId);
      if (!pack) {
        logSecurity("warn", "polar_webhook_unknown_pack", { packId });
        return NextResponse.json(
          { error: "Unknown pack" },
          { status: 400 },
        );
      }

      await addCredits(
        userId,
        pack.credits,
        "purchase",
        `Purchased ${pack.name} pack (${pack.credits} credits)`,
      );
      logSecurity("info", "credits_purchased", {
        userId,
        pack: pack.name,
        credits: pack.credits,
      });

      return NextResponse.json({ success: true, credits: pack.credits });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logSecurity("error", "polar_webhook_error", { error: String(error) });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
