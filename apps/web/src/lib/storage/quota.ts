// Per-account storage quota + per-plan upload caps.
//
// The plan defines two limits (lib/billing/plans.ts): `maxUploadMb` (largest
// single file) and `storageLimitMb` (total on-disk footprint). This module
// resolves a user's live usage against those, so the upload route, the billing
// UI, and the admin console all read one source of truth.

import { getUserPlan } from "@/lib/billing/usage";
import { userStorageBytes } from "@/lib/storage/fs";

const MB = 1024 * 1024;

export interface StorageStatus {
  usedBytes: number;
  limitBytes: number; // -1 when the plan is unlimited
  maxUploadBytes: number;
  /** Fraction 0..1 of quota used (0 when unlimited). */
  fraction: number;
}

export function getStorageStatus(userId: string): StorageStatus {
  const plan = getUserPlan(userId);
  const usedBytes = userStorageBytes(userId);
  const limitBytes = plan.storageLimitMb < 0 ? -1 : plan.storageLimitMb * MB;
  const maxUploadBytes = plan.maxUploadMb * MB;
  const fraction = limitBytes > 0 ? Math.min(1, usedBytes / limitBytes) : 0;
  return { usedBytes, limitBytes, maxUploadBytes, fraction };
}

export interface QuotaVerdict {
  ok: boolean;
  status: number;
  message?: string;
}

/**
 * Check whether `incomingBytes` of new upload fits within the user's plan:
 * both the single-file cap and the remaining total quota. `usedBytes` is passed
 * in so the caller can compute it once for a multi-file batch.
 */
export function checkUploadAllowed(
  userId: string,
  incomingBytes: number,
  usedBytes: number,
): QuotaVerdict {
  const plan = getUserPlan(userId);
  const maxUploadBytes = plan.maxUploadMb * MB;
  if (incomingBytes > maxUploadBytes) {
    return {
      ok: false,
      status: 413,
      message: `This file exceeds your plan's ${plan.maxUploadMb}MB per-file upload limit (${plan.name}). Upgrade for larger uploads.`,
    };
  }
  if (plan.storageLimitMb >= 0) {
    const limitBytes = plan.storageLimitMb * MB;
    if (usedBytes + incomingBytes > limitBytes) {
      const usedGb = (usedBytes / (1024 * MB)).toFixed(1);
      const limitGb = (limitBytes / (1024 * MB)).toFixed(0);
      return {
        ok: false,
        status: 413,
        message: `Storage full: ${usedGb}GB of ${limitGb}GB used on the ${plan.name} plan. Delete some assets to free space, or upgrade.`,
      };
    }
  }
  return { ok: true, status: 200 };
}
