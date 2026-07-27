// Mesita Ops (Staff WhatsApp) — place eligibility + guest reward copy.
// Type A = informal discount tickets only (see docs/whatsapp.md).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConsumerFirstVisit } from "./membership.ts";
import { placeHasVerifiedOwner } from "./place-ownership.ts";
import {
  assessDiscountTicketOps,
  selectDiscountPromoRate,
  type DiscountOpsEligibility,
  type PlaceOpsRow,
} from "./staff-place-ops-eligibility.ts";

export type {
  DiscountOpsBlock,
  DiscountOpsEligibility,
  DiscountOpsOk,
  PlaceOpsRow,
} from "./staff-place-ops-eligibility.ts";
export {
  assessDiscountTicketOps,
  maxConfiguredPromoRate,
  selectDiscountPromoRate,
} from "./staff-place-ops-eligibility.ts";

function tierLabelEs(tierKey: string | null | undefined): string {
  if (tierKey === "premium") return "Premium";
  return "Free";
}

/** What this guest would get at this place right now (for staff WhatsApp). */
function formatGuestRewardLine(opts: {
  ratePercent: number;
  firstVisit: boolean;
  tierKey: string | null | undefined;
  ops: DiscountOpsEligibility;
}): string {
  const tier = tierLabelEs(opts.tierKey);
  const visit = opts.firstVisit ? "primera visita en este local" : "visita recurrente";

  if (!opts.ops.ok) {
    if (opts.ops.code === "not_claimed") {
      return (
        `Recompensa para este comensal (${tier}, ${visit}): ${opts.ratePercent}% de descuento ` +
        `(aplica cuando el local tenga dueño verificado y promos activas).`
      );
    }
    return (
      `Recompensa para este comensal (${tier}, ${visit}): sin descuento activo (0%) — ` +
      `activa porcentajes en Mesita Business → Promos.`
    );
  }

  if (opts.ratePercent <= 0) {
    return (
      `Recompensa para este comensal (${tier}, ${visit}): 0% de descuento en este local. ` +
      `Revisa los porcentajes en Promos.`
    );
  }

  return (
    `Recompensa para este comensal (${tier}, ${visit}): ${opts.ratePercent}% de descuento en la cuenta.`
  );
}

export async function loadPlaceOpsRow(
  admin: SupabaseClient,
  projectId: string,
): Promise<PlaceOpsRow | null> {
  const res = await admin
    .from("projects_view")
    .select(
      "id, name, slug, photos, instagram_url, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, monthly_promo_cap, listing_type, status, fiscal_type, plan, staff_channel_pinged_at, first_ticket_honored_at, membership_live_at, strike_count, last_strike_at, promo_paused_until, membership_forfeited_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as PlaceOpsRow;
}

export async function guestRewardContext(
  admin: SupabaseClient,
  place: PlaceOpsRow,
  consumerId: string,
  tierKey: string | null | undefined,
): Promise<{
  ops: DiscountOpsEligibility;
  ratePercent: number;
  firstVisit: boolean;
  rewardLine: string;
}> {
  const firstVisit = await isConsumerFirstVisit(admin, consumerId, place.id);
  const hasOwner = await placeHasVerifiedOwner(admin, place.id);
  const ops = assessDiscountTicketOps(place, hasOwner);
  const ratePercent = selectDiscountPromoRate(place, tierKey, firstVisit);
  const rewardLine = formatGuestRewardLine({
    ratePercent,
    firstVisit,
    tierKey,
    ops,
  });
  return { ops, ratePercent, firstVisit, rewardLine };
}

/** Short note when staff picks a unit that cannot run discount tickets yet. */
export async function placeOpsShortWarning(
  admin: SupabaseClient,
  projectId: string,
): Promise<string> {
  const place = await loadPlaceOpsRow(admin, projectId);
  if (!place) return "";
  const hasOwner = await placeHasVerifiedOwner(admin, projectId);
  const ops = assessDiscountTicketOps(place, hasOwner);
  if (ops.ok) return "";
  return (
    "\n\n⚠️ Este local no puede abrir tickets con descuento por WhatsApp todavía. " +
    "Configura Promos en Mesita Business."
  );
}
