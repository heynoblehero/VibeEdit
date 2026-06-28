// Client-side cache + in-flight dedupe for GET /api/billing/me. The endpoint
// is read on the editor page (RenderPanel, future widgets) which can mount
// many times per session — without this, we'd fetch it per mount.
//
// Cache TTL: 60 seconds. Subscription state doesn't shift faster than that
// outside of an explicit Polar webhook event. Clients can call refreshMe()
// after a checkout return to force a refetch.

export type PlanId = "free" | "creator" | "studio";

export type BillingMe = {
  plan: {
    id: PlanId;
    name: string;
    renderLimit: number;
    chatTurnLimit: number;
    resolution: "720p" | "1080p" | "4k";
    watermark: boolean;
  };
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    renders: { used: number; limit: number };
    chatTurns: { used: number; limit: number };
  };
};

const TTL_MS = 60_000;
const STORAGE_KEY = "vibeedit:billing-me";
const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;
let cached: { fetchedAt: number; data: BillingMe } | null = null;
let inFlight: Promise<BillingMe | null> | null = null;

function loadFromStorage(): { fetchedAt: number; data: BillingMe } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt: number; data: BillingMe };
    if (
      !parsed?.fetchedAt ||
      !parsed?.data?.plan?.id ||
      Date.now() - parsed.fetchedAt > STALE_LIMIT_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(payload: { fetchedAt: number; data: BillingMe }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / privacy mode */
  }
}

export async function getMe(): Promise<BillingMe | null> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.data;
  if (!cached) {
    const persisted = loadFromStorage();
    if (persisted) cached = persisted;
  }
  if (inFlight) return cached?.data ?? inFlight;
  inFlight = fetch("/api/billing/me")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: BillingMe | null) => {
      if (data) {
        cached = { fetchedAt: Date.now(), data };
        saveToStorage(cached);
      }
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  // If we have any cached value (even from disk) hand it back immediately
  // while the refresh fires in the background — classic SWR.
  return cached?.data ?? inFlight;
}

export function refreshMe(): Promise<BillingMe | null> {
  cached = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
  }
  return getMe();
}
