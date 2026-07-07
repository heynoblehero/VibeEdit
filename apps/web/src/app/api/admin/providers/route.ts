import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { providerCredentials } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/api-keys/crypto";
import { MANAGED_PROVIDERS } from "@/lib/ai/models";
import {
  getGenerationPricing,
  setGenerationPricing,
  type GenerationPricing,
} from "@/lib/billing/generation-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Providers the pool can hold — the single source of truth lives in the model
// registry (MANAGED_PROVIDERS in lib/ai/models.ts) so the console can never
// drift out of sync with the ids the dispatcher resolves.
const PROVIDERS = MANAGED_PROVIDERS;

const VALID_PROVIDERS = new Set(PROVIDERS.map((p) => p.id));

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const rows = db
    .select()
    .from(providerCredentials)
    .orderBy(desc(providerCredentials.priority), desc(providerCredentials.createdAt))
    .all();

  // Never return secrets — only a masked last4.
  const credentials = rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    kind: r.kind,
    label: r.label,
    endpoint: r.endpoint,
    masked: r.last4 ? `••••${r.last4}` : maskApiKey(""),
    enabled: r.enabled,
    priority: r.priority,
    usageCount: r.usageCount,
    lastUsedAt: r.lastUsedAt,
    disabledReason: r.disabledReason,
  }));

  return NextResponse.json({
    providers: PROVIDERS,
    credentials,
    pricing: getGenerationPricing(),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    provider?: string;
    kind?: "key" | "proxy";
    label?: string;
    secret?: string;
    endpoint?: string;
    enabled?: boolean;
    priority?: number;
    pricing?: GenerationPricing;
  } | null;
  if (!body?.action) return new Response("action required", { status: 400 });

  switch (body.action) {
    case "create": {
      if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
        return new Response("invalid provider", { status: 400 });
      }
      if (!body.secret || body.secret.trim().length < 4) {
        return new Response("secret required", { status: 400 });
      }
      const meta = PROVIDERS.find((p) => p.id === body.provider)!;
      const kind = body.kind ?? meta.kind;
      if (kind === "proxy" && !body.endpoint) {
        return new Response("endpoint required for proxy", { status: 400 });
      }
      const secret = body.secret.trim();
      const now = new Date();
      db.insert(providerCredentials)
        .values({
          id: nanoid(14),
          provider: body.provider,
          kind,
          label: body.label?.slice(0, 80) || null,
          secretEnc: encryptApiKey(secret),
          endpoint: kind === "proxy" ? body.endpoint!.trim() : null,
          last4: secret.slice(-4),
          enabled: true,
          priority: body.priority ?? 0,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return NextResponse.json({ ok: true });
    }

    case "update": {
      if (!body.id) return new Response("id required", { status: 400 });
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.enabled === "boolean") {
        set.enabled = body.enabled;
        // Re-enabling clears the auto-disable reason.
        if (body.enabled) set.disabledReason = null;
      }
      if (typeof body.priority === "number") set.priority = body.priority;
      if (typeof body.label === "string") set.label = body.label.slice(0, 80);
      if (typeof body.endpoint === "string") set.endpoint = body.endpoint.trim();
      if (body.secret && body.secret.trim().length >= 4) {
        set.secretEnc = encryptApiKey(body.secret.trim());
        set.last4 = body.secret.trim().slice(-4);
      }
      db.update(providerCredentials).set(set).where(eq(providerCredentials.id, body.id)).run();
      return NextResponse.json({ ok: true });
    }

    case "delete": {
      if (!body.id) return new Response("id required", { status: 400 });
      db.delete(providerCredentials).where(eq(providerCredentials.id, body.id)).run();
      return NextResponse.json({ ok: true });
    }

    case "test": {
      if (!body.id) return new Response("id required", { status: 400 });
      const row = db
        .select()
        .from(providerCredentials)
        .where(eq(providerCredentials.id, body.id))
        .get();
      if (!row) return new Response("not found", { status: 404 });
      const result = await testCredential(row);
      return NextResponse.json(result);
    }

    case "pricing": {
      if (!body.pricing) return new Response("pricing required", { status: 400 });
      setGenerationPricing(body.pricing);
      return NextResponse.json({ ok: true, pricing: getGenerationPricing() });
    }

    default:
      return new Response("unknown action", { status: 400 });
  }
}

// Lightweight reachability/auth check. Key providers hit their probe endpoint;
// proxies just check the base URL responds.
async function testCredential(row: {
  provider: string;
  kind: string;
  secretEnc: string;
  endpoint: string | null;
}): Promise<{ ok: boolean; detail?: string; error?: string }> {
  let secret: string;
  try {
    secret = decryptApiKey(row.secretEnc);
  } catch {
    return { ok: false, error: "cannot decrypt (API_KEYS_SECRET changed?)" };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    if (row.provider === "elevenlabs") {
      res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
        headers: { "xi-api-key": secret },
        signal: controller.signal,
      });
    } else if (row.provider === "replicate") {
      res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${secret}` },
        signal: controller.signal,
      });
    } else if (row.provider === "anthropic") {
      const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
        /\/$/,
        "",
      );
      res = await fetch(`${base}/v1/models`, {
        headers: { "x-api-key": secret, "anthropic-version": "2023-06-01" },
        signal: controller.signal,
      });
    } else if (row.endpoint) {
      // Proxy (or any row with an endpoint): just check the base URL responds.
      res = await fetch(row.endpoint.replace(/\/+$/, ""), {
        method: "GET",
        signal: controller.signal,
      });
    } else {
      // A key provider with no first-party probe wired here (e.g. Runway/Pika).
      // We can't auth-check it without a real API call, so report it as stored
      // rather than firing fetch("") which would always error.
      clearTimeout(timer);
      return { ok: true, detail: "saved — no reachability probe for this provider" };
    }
    clearTimeout(timer);
    if (res.ok || res.status === 401 || res.status === 403) {
      return res.ok
        ? { ok: true, detail: `reachable (${res.status})` }
        : { ok: false, error: `auth rejected (${res.status})` };
    }
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
