"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Notification feed types — mirror of the admin-list-notifications EF
// envelope. The shape is category-agnostic on purpose: future categories
// (billing, verifications, consumers…) reuse the same item shape and the
// client renders title/icon from `type`.

type NotificationCategory = "atlas";

export type NotificationType =
  | "atlas.place_created"
  | "atlas.place_enriched"
  | "atlas.ownership_claimed"
  | "atlas.enrichment_step";

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

export type NotificationsPayload = {
  notifications: NotificationItem[];
  counts: Record<string, number>;
  categories: NotificationCategory[];
  total: number;
  generatedAt: string;
};

export type NotificationsResult =
  | { ok: true; data: NotificationsPayload }
  | { ok: false; error: string };

// Optional server-side narrowing supported by the EF. `limit` caps the feed
// size (step events are chatty, so we fetch a bigger window by default).
export type ListNotificationsOptions = {
  types?: NotificationType[];
  projectId?: string;
  q?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 150;

export async function listNotifications(
  category: NotificationCategory | "all" = "all",
  opts: ListNotificationsOptions = {},
): Promise<NotificationsResult> {
  const r = await efInvoke<NotificationsPayload>("admin-web-list-notifications", {
    category,
    limit: opts.limit ?? DEFAULT_LIMIT,
    ...(opts.types && opts.types.length > 0 ? { types: opts.types } : {}),
    ...(opts.projectId ? { placeId: opts.projectId } : {}),
    ...(opts.q ? { q: opts.q } : {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
