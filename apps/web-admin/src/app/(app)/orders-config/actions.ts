"use server";

// Server actions for Orders Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-orders-config on app_config.orders_config.
// WHOLE-BLOB save: the two quotas are a related pair, so a per-key merge could
// persist a Premium plan that allows fewer orders than Free. No client ever
// touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { ORDERS_FALLBACK, type OrdersConfig } from "./defaults";

type ConfigPayload = { config: unknown; updatedAt: string | null };

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

// Mirrors supabase/functions/_shared/orders-config.ts — the EF is
// authoritative; this keeps the form honest if the blob is older than the
// current shape.
function normalize(raw: unknown): OrdersConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ch = (r.channels ?? {}) as Record<string, unknown>;
  const free = Math.round(
    num(r.monthlyQuotaFree, ORDERS_FALLBACK.monthlyQuotaFree, 0, 1000),
  );
  return {
    enabled: bool(r.enabled, ORDERS_FALLBACK.enabled),
    channels: {
      inHouse: bool(ch.inHouse, ORDERS_FALLBACK.channels.inHouse),
      externalLink: bool(
        ch.externalLink,
        ORDERS_FALLBACK.channels.externalLink,
      ),
      whatsapp: bool(ch.whatsapp, ORDERS_FALLBACK.channels.whatsapp),
    },
    delivery: bool(r.delivery, ORDERS_FALLBACK.delivery),
    pickup: bool(r.pickup, ORDERS_FALLBACK.pickup),
    monthlyQuotaFree: free,
    monthlyQuotaPremium: Math.max(
      free,
      Math.round(
        num(
          r.monthlyQuotaPremium,
          ORDERS_FALLBACK.monthlyQuotaPremium,
          0,
          1000,
        ),
      ),
    ),
    minOrderMxn: Math.round(
      num(r.minOrderMxn, ORDERS_FALLBACK.minOrderMxn, 0, 100000),
    ),
    rewardWindowHours: Math.round(
      num(r.rewardWindowHours, ORDERS_FALLBACK.rewardWindowHours, 1, 720),
    ),
    requireProof: bool(r.requireProof, ORDERS_FALLBACK.requireProof),
  };
}

type GetResult =
  | { ok: true; config: OrdersConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getOrdersConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-orders-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: OrdersConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateOrdersConfig(
  config: OrdersConfig,
): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-orders-config", {
    config,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
