"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Notification feed types — mirror of the admin-list-notifications EF
// envelope. The shape is category-agnostic on purpose: future categories
// (billing, verifications, consumers…) reuse the same item shape and the
// client renders title/icon from `type`.

export type NotificationCategory = "atlas";

export type NotificationType =
  | "atlas.place_created"
  | "atlas.place_enriched"
  | "atlas.ownership_claimed";

export type NotificationPlace = {
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

export async function listNotifications(
  category: NotificationCategory | "all" = "all",
): Promise<NotificationsResult> {
  const r = await efInvoke<NotificationsPayload>("admin-list-notifications", {
    category,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
