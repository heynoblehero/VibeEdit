import { DELETE as deleteAccount } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legacy alias for self-service account deletion. The real implementation —
// confirm gate, Polar cancellation, FK cascade, full on-disk storage cleanup —
// lives in ../route.ts (DELETE /api/account). Re-exported here so the older
// /api/account/me endpoint stays working but shares the hardened code path
// (previously this duplicated a weaker delete with no confirm gate).
export const DELETE = deleteAccount;
