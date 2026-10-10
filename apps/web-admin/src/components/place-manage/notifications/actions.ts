// Event-receipt item shape. The operator Activity tab maps
// `business-web-get-performance`'s feed into this (MESITA-1740); the
// super-admin monitor still reads the admin list door.

type NotificationCategory = "atlas" | "consumer" | "rewards" | "reservations";

export type NotificationType =
  | "atlas.place_created"
  | "atlas.place_enriched"
  | "atlas.ownership_claimed"
  | "atlas.enrichment_step"
  | "consumer.place_saved"
  | "rewards.ticket_created"
  | "rewards.ticket_visit"
  | "rewards.ticket_closed"
  | "rewards.review_submitted"
  | "rewards.ticket_reported"
  | "reservations.reservation_created";

type NotificationPlace = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  categoryLabel: string | null;
  googlePlaceId: string | null;
} | null;

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  occurredAt: string;
  place: NotificationPlace;
  actor: string | null;
  detail: string | null;
  meta: Record<string, unknown>;
};
