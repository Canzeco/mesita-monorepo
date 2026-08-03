// Consumer bill payload + money formatting helpers for ticket Realtime
// notifications.

import { instagramHandleFromUrl } from "./apify.ts";
import type { InformalBillCalc } from "./ticket-informal.ts";

export function formatMoneyMx(cents: number, currency = "MXN"): string {
  const major = (cents / 100).toFixed(2);
  return `$${major} ${currency}`;
}

/** Payload for consumer Pay → Tickets (Realtime notification). */
export function placeInstagramHandleForPayload(
  instagramUrl: string | null | undefined,
): string | null {
  return instagramHandleFromUrl(instagramUrl);
}

export function buildConsumerBillPayload(
  place: {
    name: string;
    photos?: string[] | null;
    slug?: string | null;
    monthly_promo_cap?: number | null;
    instagram_url?: string | null;
  },
  calc: InformalBillCalc,
  projectId: string,
): Record<string, unknown> {
  const discount = calc.discountCents ?? 0;
  return {
    project_id: projectId,
    place_slug: place.slug ?? null,
    place_name: place.name,
    place_photo_url: place.photos?.[0] ?? null,
    place_instagram_handle: placeInstagramHandleForPayload(place.instagram_url),
    check_subtotal_cents: calc.subtotal,
    tip_cents: calc.tip,
    total_cents: calc.total,
    discount_cents: discount,
    discount_percent: calc.discountPercent,
    total_reward_cents: discount,
    reward_cap_mxn: place.monthly_promo_cap ?? null,
    amount_due_cents: calc.amountDueCents,
    currency: "MXN",
  };
}
