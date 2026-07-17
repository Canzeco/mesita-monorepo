// Mesita Ops (Staff WhatsApp) — promo eligibility for discount tickets.
// Type A = informal discount tickets only (see docs/whatsapp.md).

import { type PlaceRates } from "./membership.ts";
import {
  assessPromoLane,
  type MembershipRow,
} from "./membership-enforcement.ts";
import type { PlaceRateRow } from "./ticket-informal.ts";

export type PlaceOpsRow = PlaceRateRow & {
  plan: string | null;
  instagram_url?: string | null;
  staff_channel_pinged_at?: string | null;
  first_ticket_honored_at?: string | null;
  membership_live_at?: string | null;
  strike_count?: number | null;
  last_strike_at?: string | null;
  promo_paused_until?: string | null;
  membership_forfeited_at?: string | null;
};

// Paid place plans (public.membership enum). fiscal_type is checked
// separately, so this only distinguishes Free from the paid tiers.
const DISCOUNT_PLANS = new Set(["pro", "ultra"]);

export type DiscountOpsBlock = {
  ok: false;
  code:
    | "not_claimed"
    | "formal_place"
    | "free_plan"
    | "wrong_plan"
    | "no_rates_configured"
    | "membership_forfeited"
    | "membership_not_activated"
    | "promo_paused";
  staffMessage: string;
};

export type DiscountOpsOk = {
  ok: true;
};

export type DiscountOpsEligibility = DiscountOpsBlock | DiscountOpsOk;

/** Highest configured promo % across welcome + returning, free + premium. */
export function maxConfiguredPromoRate(place: PlaceRates): number {
  const candidates = [
    place.welcome_free_rate,
    place.welcome_premium_rate,
    place.free_rate,
    place.premium_rate,
  ];
  let max = 0;
  for (const r of candidates) {
    if (r != null && r > max) max = r;
  }
  return Math.max(0, Math.min(100, max));
}

/** Discount % from Promos toggles only (null/Off = 0). */
export function selectDiscountPromoRate(
  place: PlaceRates,
  tier: string | null | undefined,
  isFirstVisit: boolean,
): number {
  const isPremium = tier === "premium";
  let rate: number | null = null;
  if (isFirstVisit) {
    rate = isPremium
      ? place.welcome_premium_rate ?? place.welcome_free_rate
      : place.welcome_free_rate;
  } else {
    rate = isPremium
      ? place.premium_rate ?? place.free_rate
      : place.free_rate;
  }
  return Math.max(0, Math.min(100, rate ?? 0));
}

export function assessDiscountTicketOps(
  place: PlaceOpsRow,
  hasVerifiedOwner: boolean,
): DiscountOpsEligibility {
  if (place.fiscal_type !== "informal") {
    return {
      ok: false,
      code: "formal_place",
      staffMessage:
        "Este local no está configurado para descuentos en cuenta.\n\n" +
        "Mesita Ops por WhatsApp solo abre tickets con descuento (tipo A).\n" +
        "Para usar este canal: Mesita Business → Promos → elige «Pro» o «Ultra» y configura porcentajes.",
    };
  }

  const plan = (place.plan ?? "free").toLowerCase();
  if (plan === "free") {
    return {
      ok: false,
      code: "free_plan",
      staffMessage:
        "Este local está en plan Free — las promos están bloqueadas en 0%.\n\n" +
        "En Mesita Business → Promos activa «Pro» o «Ultra» y configura los porcentajes (Free / Premium, primera visita y recurrente).",
    };
  }

  if (!DISCOUNT_PLANS.has(plan)) {
    return {
      ok: false,
      code: "wrong_plan",
      staffMessage:
        "El plan de este local no incluye tickets con descuento por WhatsApp.\n\n" +
        "En Mesita Business → Promos elige «Pro» o «Ultra».",
    };
  }

  if (maxConfiguredPromoRate(place) === 0) {
    return {
      ok: false,
      code: "no_rates_configured",
      staffMessage:
        "Este local ya tiene plan con descuentos, pero todos los porcentajes están en Off (0%).\n\n" +
        "Actívalos en Mesita Business → Promos (Free / Premium, primera visita y visitas recurrentes).",
    };
  }

  if (!hasVerifiedOwner) {
    return {
      ok: false,
      code: "not_claimed",
      staffMessage:
        "Este local aún no tiene dueño verificado en Mesita (reclamar el local en la app).\n" +
        "Sin eso no puedes abrir tickets con descuento por WhatsApp.",
    };
  }

  // Promos v4 membership gate (MESITA-542): activation + strikes.
  const membership: MembershipRow = {
    id: place.id,
    plan: place.plan,
    staff_channel_pinged_at: place.staff_channel_pinged_at ?? null,
    first_ticket_honored_at: place.first_ticket_honored_at ?? null,
    membership_live_at: place.membership_live_at ?? null,
    strike_count: place.strike_count ?? 0,
    last_strike_at: place.last_strike_at ?? null,
    promo_paused_until: place.promo_paused_until ?? null,
    membership_forfeited_at: place.membership_forfeited_at ?? null,
  };
  const lane = assessPromoLane(membership);
  if (!lane.open) {
    const code =
      lane.code === "forfeited"
        ? "membership_forfeited"
        : lane.code === "paused"
        ? "promo_paused"
        : "membership_not_activated";
    return { ok: false, code, staffMessage: lane.staffMessage };
  }

  return { ok: true };
}
