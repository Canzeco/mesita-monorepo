"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Manage › Premier (MESITA-3011) ─────────────────────────────────────

export type PremierRow = {
  id: string;
  name: string;
  /** places.boost_tier: 0 none · 1 2X · 2 5X. */
  tier: 0 | 1 | 2;
  factor: number;
  /** Manual Premier running now (MESITA-3091). Optional until every EF build sends it. */
  manual?: { tier: number; ends_at: string; source: "admin" | "purchase"; granted_by: string | null } | null;
  /** The paid period running now (`granted` is always false since MESITA-3091). */
  period: { tier: number; ends_at: string; granted: boolean; granted_by: string | null } | null;
  /** A renewal or upgrade charge is in flight at Stripe. */
  charging: boolean;
  /** 1 when the place's subscription (MESITA-3092: one per place) is not
   *  paying the running period: its renewal is due. */
  backups: number;
  /** Pledges whose Checkout is open. */
  waiting: number;
  charged_30d_cents: number;
};

export type PremierList = {
  stripe: "test" | "live" | "off";
  totals: { premier_now: number; granted_now: number; pledges: number; charged_30d_cents: number };
  places: PremierRow[];
};

export async function listPremier(): Promise<ActionResult<{ list: PremierList }>> {
  const r = await efInvoke<PremierList>("admin-web-list-premier", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    list: { stripe: r.data.stripe, totals: r.data.totals, places: r.data.places ?? [] },
  };
}
