// Consumer ticket API — Tickets v2 self-check-in (MESITA-806).
//
// The Rewards New/History tabs are TICKET-driven (consumer-web-list-tickets),
// not notification-driven: a just-created ticket must be visible immediately,
// QR and all. Notifications stay as the bill push/poll signal
// (lib/api/notifications.ts) — tickets are the state, notifications the event.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// Mirrors _shared/reservation-places.ts attachPlaces — the EF returns the
// full summary; fields the wallet didn't need were previously under-declared.
export type ConsumerTicketPlace = {
  id: string;
  name: string | null;
  photos: string[] | null;
  category?: string | null;
  address?: string | null;
  price_level?: number | null;
  slug?: string | null;
} | null;

export type ConsumerTicketRow = {
  id: string;
  kind: string;
  status: string;
  story_status: string | null;
  story_submitted_at: string | null;
  story_verified_at: string | null;
  story_reject_reason: string | null;
  review_status: string | null;
  review_submitted_at: string | null;
  check_code: string | null;
  first_scanned_at: string | null;
  check_subtotal_cents: number | null;
  total_cents: number | null;
  discount_percent: number | null;
  discount_cents: number | null;
  currency: string | null;
  created_at: string;
  revealed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  project_id: string;
  place: ConsumerTicketPlace;
};

export const ACTIVE_TICKET_STATUSES = new Set([
  "open",
  "awaiting_story",
  "awaiting_payment_confirm",
]);

export async function apiListConsumerTickets(
  client: SupabaseClient,
  limit = 50,
): Promise<ConsumerTicketRow[]> {
  const { tickets } = await invokeEF<{ tickets: ConsumerTicketRow[] }>(
    client,
    "consumer-web-list-tickets",
    { limit },
  );
  return tickets ?? [];
}

export type CreatedTicket = {
  id: string;
  status: string;
  check_code: string;
  place_name: string | null;
  place_slug: string | null;
};

export async function apiCreateTicket(
  client: SupabaseClient,
  placeId: string,
  wantsStory: boolean,
): Promise<{ ticket: CreatedTicket; checkUrl: string }> {
  return await invokeEF<{ ticket: CreatedTicket; checkUrl: string }>(
    client,
    "consumer-web-create-ticket",
    { placeId, wantsStory },
  );
}

export async function apiCancelTicket(
  client: SupabaseClient,
  ticketId: string,
): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(client, "consumer-web-cancel-ticket", {
    ticketId,
  });
}


// ── Guest actions on a live ticket (MESITA-824) ─────────────────────────
//
// Both EFs require a real https screenshot URL. Until the upload flow exists,
// the pass sends DEMO_SCREENSHOT_URL — a real, loadable asset on our own
// domain that is obviously not a screenshot, so staff reviewing it on the
// check page can tell at a glance that it's a placeholder rather than a
// guest's genuine proof. Swap this one constant for the uploaded URL when
// the upload lands; nothing else changes.
export const DEMO_SCREENSHOT_URL = "https://mesita.ai/icon.svg";

export async function apiSubmitStory(
  client: SupabaseClient,
  ticketId: string,
  screenshotUrl: string = DEMO_SCREENSHOT_URL,
): Promise<void> {
  await invokeEF(client, "consumer-web-submit-story", {
    ticketId,
    screenshotUrl,
  });
}

export async function apiSubmitReview(
  client: SupabaseClient,
  ticketId: string,
  screenshotUrl: string = DEMO_SCREENSHOT_URL,
): Promise<void> {
  await invokeEF(client, "consumer-web-submit-review", {
    ticketId,
    screenshotUrl,
  });
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
export function checkUrlForCode(code: string): string {
  return `https://mesita.ai/check/${code}`;
}
