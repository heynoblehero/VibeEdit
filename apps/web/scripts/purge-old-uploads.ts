#!/usr/bin/env tsx
/*
 * Opt-in daily cron: reclaim disk by deleting OLD uploaded assets.
 *
 * DISABLED BY DEFAULT. It only runs when PURGE_UPLOADS_DAYS is set to a positive
 * number — otherwise it no-ops and exits 0. This is intentional: age-based
 * purging can remove source footage a project still references, so an operator
 * must explicitly opt in with a retention window.
 *
 *   PURGE_UPLOADS_DAYS=30   → delete assets whose mtime is older than 30 days
 *
 * Scope: every user's …/projects/<userId>/<projectId>/assets/* file. Renders,
 * compositions, thumbs, personas and brand-kits are NOT touched.
 *
 * Cron suggestion (Dokku):
 *   dokku config:set vibeedit PURGE_UPLOADS_DAYS=30
 *   dokku cron:add vibeedit "cd /app/apps/web && bun run scripts/purge-old-uploads.ts" "30 3 * * *"
 */

import { readdirSync } from "node:fs";
import { allProjectsRoot, purgeUserAssets, type PurgeResult } from "../src/lib/storage/fs";

function main() {
  const days = Number(process.env.PURGE_UPLOADS_DAYS);
  if (!Number.isFinite(days) || days <= 0) {
    console.log("[purge-old-uploads] PURGE_UPLOADS_DAYS unset/invalid — skipping (disabled).");
    return;
  }

  const olderThanMs = days * 24 * 60 * 60 * 1000;
  const root = allProjectsRoot();

  let userIds: string[] = [];
  try {
    userIds = readdirSync(root);
  } catch {
    console.log(`[purge-old-uploads] no projects root at ${root} — nothing to do.`);
    return;
  }

  const total: PurgeResult = { deletedCount: 0, freedBytes: 0 };
  for (const userId of userIds) {
    const result = purgeUserAssets(userId, olderThanMs);
    total.deletedCount += result.deletedCount;
    total.freedBytes += result.freedBytes;
  }

  const freedMb = (total.freedBytes / (1024 * 1024)).toFixed(1);
  console.log(
    `[purge-old-uploads] done: removed ${total.deletedCount} assets older than ${days}d across ${userIds.length} users, freed ${freedMb}MB.`,
  );
}

main();
