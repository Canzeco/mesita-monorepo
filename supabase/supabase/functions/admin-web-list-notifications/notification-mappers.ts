import {
  placeRef,
  type PlaceRef,
  type PlaceShape,
} from "./notification-shapes.ts";

export type Category = "atlas";

export type NotificationType =
  | "atlas.place_created"
  | "atlas.place_enriched"
  | "atlas.enrichment_step"
  | "atlas.ownership_claimed";

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
