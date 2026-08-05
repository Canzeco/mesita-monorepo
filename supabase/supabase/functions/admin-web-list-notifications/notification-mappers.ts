import {
  placeRef,
  type PlaceRef,
  type PlaceShape,
} from "./notification-shapes.ts";

export type Category = "atlas" | "consumer" | "rewards" | "reservations";

export type NotificationType =
  | "atlas.place_created"
  | "atlas.place_enriched"
  | "atlas.enrichment_step"
  | "atlas.ownership_claimed"
  | "consumer.place_saved"
  | "rewards.ticket_created"
  | "rewards.ticket_visit"
  // v3b (MESITA-850/890): the close is "marks as done", not a payment.
  | "rewards.ticket_closed"
  | "rewards.review_submitted"
  // v3c (MESITA-851): the guest filed a complaint about a visit. The one
  // event here that asks the operator to DO something.
  | "rewards.ticket_reported"
  | "reservations.reservation_created";

export type NotificationItem = {
  // Stable per underlying row so the client can key/dedupe across refreshes.
  id: string;
  category: Category;
  type: NotificationType;
  occurredAt: string;
  place: PlaceRef;
  // "Who" — owner display for creations, requester email for claims,
  // "Enricher" for enrichment events. null when genuinely unknown.
  actor: string | null;
  // Free-text detail — the enrichment summary snippet / step detail line.
  detail: string | null;
  meta: Record<string, unknown>;
};

export type CreatedNotificationRow = PlaceShape & {
  listing_type: string | null;
  status: string | null;
  created_at: string;
  enriched_at: string | null;
};

export type NotificationOwner = {
  email: string | null;
  name: string | null;
};

// Consumer display name for activity events — the same precedence the
// consumer app uses: full name, else first+last, else IG handle. Never the
// phone (the feed is operator-facing but names read better than numbers,
// and the phone is PII we don't need here).
export type ConsumerShape = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  instagram_handle: string | null;
};

export function consumerActor(c: ConsumerShape | null): string | null {
  if (!c) return null;
  const full = c.full_name?.trim();
  if (full) return full;
  const joined = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  const ig = c.instagram_handle?.trim();
  if (ig) return `@${ig.replace(/^@/, "")}`;
  return null;
}

export function mapPlaceCreatedNotification(
  v: CreatedNotificationRow,
  owner: NotificationOwner | undefined,
): NotificationItem {
  const actor = owner
    ? owner.name
      ? owner.email
        ? `${owner.name} · ${owner.email}`
        : owner.name
      : owner.email
    : null;
  return {
    id: `atlas.place_created:${v.id}`,
    category: "atlas",
    type: "atlas.place_created",
    occurredAt: v.created_at,
    place: placeRef(v),
    actor,
    detail: null,
    meta: {
      listingType: v.listing_type,
      status: v.status,
      enriched: v.enriched_at != null,
      claimed: !!owner,
    },
  };
}
