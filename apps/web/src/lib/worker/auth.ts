import { eq } from "drizzle-orm";
import { db } from "../db";
import { workerTokens } from "../db/schema";

export type WorkerAuth = { userId: string; tokenName: string };

export function authenticateWorker(req: Request): WorkerAuth | null {
	const header = req.headers.get("authorization") || "";
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) return null;
	const token = match[1].trim();
	const row = db
		.select()
		.from(workerTokens)
		.where(eq(workerTokens.token, token))
		.get();
	if (!row || row.revokedAt) return null;
	db.update(workerTokens)
		.set({ lastSeenAt: new Date() })
		.where(eq(workerTokens.token, token))
		.run();
	return { userId: row.userId, tokenName: row.name };
}
