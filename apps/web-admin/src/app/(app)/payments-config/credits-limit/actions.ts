"use server";

// Admin › Payments › Credits Limit (MESITA-3947): thin wrappers over
// admin-web-get-credits-limit and admin-web-save-credits-limit.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

export type LimitDefault = { currency: string; limit_cents: number; updated_at: string };

export type LimitPlace = {
  place_id: string;
  place_name: string | null;
  currency: string;
  outstanding_cents: number;
  /** The place's own limit; null = its tier. */
  override_cents: number | null;
  /** The limit that binds it now; null when its currency has no default. */
  limit_cents: number | null;
  loyalty_cards: boolean;
  /** What binds (MESITA-4733): custom = its own limit; none · credits ·
   *  stripe = an MXN tier; default = its currency's default. */
  tier?: "custom" | "none" | "credits" | "stripe" | "default";
  /** What it would get without its own limit, and from which tier. */
  tier_limit_cents?: number | null;
  tier_name?: "none" | "credits" | "stripe" | "default";
};

export type CreditsLimit = { test_mode: boolean; defaults: LimitDefault[]; places: LimitPlace[] };

export async function getCreditsLimit(): Promise<ActionResult<CreditsLimit>> {
  const r = await efInvoke<CreditsLimit>("admin-web-get-credits-limit", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, test_mode: !!r.data.test_mode, defaults: r.data.defaults ?? [], places: r.data.places ?? [] };
}

export async function saveDefaultLimit(currency: string, limitCents: number): Promise<ActionResult> {
  const r = await efInvoke<{ ok: true }>("admin-web-save-credits-limit", { currency, limit_cents: limitCents });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** `limitCents` null puts the place back on its currency's default. */
export async function savePlaceLimit(placeId: string, limitCents: number | null): Promise<ActionResult> {
  const r = await efInvoke<{ ok: true }>("admin-web-save-credits-limit", { place_id: placeId, limit_cents: limitCents });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
