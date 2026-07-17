import type { TicketBillSnapshot } from "../_shared/business-ticket-billing.ts";

export type TicketPlaceSnapshot = {
  id: string;
  slug?: string | null;
  name: string;
  photos?: string[] | null;
};

export function buildBillNotificationPayload(
  place: TicketPlaceSnapshot,
  kind: string,
  snap: TicketBillSnapshot,
  capPesos: number | null,
  currency: string | null,
) {
  return {
    project_id: place.id,
    place_slug: place.slug ?? null,
    place_name: place.name,
    place_photo_url: place.photos?.[0] ?? null,
    ticket_kind: kind,
    check_subtotal_cents: snap.checkSubtotalCents,
    tip_cents: snap.tipCents,
    total_cents: snap.totalCents,
    discount_cents: snap.discountCents ?? 0,
    discount_percent: snap.discountPercent ?? 0,
    total_reward_cents: snap.discountCents ?? 0,
    reward_cap_mxn: capPesos ?? null,
    amount_due_cents: snap.amountDueCents,
    currency: currency ?? "MXN",
  };
}
