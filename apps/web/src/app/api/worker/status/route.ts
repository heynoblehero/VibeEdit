import { NextResponse } from "next/server";
import { canUseCloudRender } from "@/lib/billing/usage";
import { requireServerSession } from "@/lib/server-session";

export async function GET() {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const gate = canUseCloudRender(userId);
	return NextResponse.json({
		hasWorker: gate.hasWorker,
		cloudSecondsUsed: gate.used,
		cloudSecondsLimit: gate.limit,
		blocked: !gate.ok,
	});
}
