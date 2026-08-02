// Consumer ticket API — Tickets v2 self-check-in (MESITA-806). Mirror of
// apps/web-consumer/src/lib/api/tickets.ts (mobile passes the singleton
// client per this package's api convention).

import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

export type ConsumerTicketPlace = {
  id: string;
  name: string | null;
  photos: string[] | null;
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
  'open',
  'awaiting_story',
  'awaiting_payment_confirm',
]);

export async function apiListConsumerTickets(
  limit = 50,
): Promise<ConsumerTicketRow[]> {
  const { tickets } = await invokeEF<{ tickets: ConsumerTicketRow[] }>(
    supabase,
    'consumer-web-list-tickets',
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
  placeId: string,
  wantsStory: boolean,
): Promise<{ ticket: CreatedTicket; checkUrl: string }> {
  return await invokeEF<{ ticket: CreatedTicket; checkUrl: string }>(
    supabase,
    'consumer-web-create-ticket',
    { placeId, wantsStory },
  );
}

export async function apiCancelTicket(ticketId: string): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(supabase, 'consumer-web-cancel-ticket', {
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
export const DEMO_SCREENSHOT_URL = 'https://mesita.ai/icon.svg';

export async function apiSubmitStory(
  ticketId: string,
  screenshotUrl: string = DEMO_SCREENSHOT_URL,
): Promise<void> {
  await invokeEF(supabase, 'consumer-web-submit-story', {
    ticketId,
    screenshotUrl,
  });
}

export async function apiSubmitReview(
  ticketId: string,
  screenshotUrl: string = DEMO_SCREENSHOT_URL,
): Promise<void> {
  await invokeEF(supabase, 'consumer-web-submit-review', {
    ticketId,
    screenshotUrl,
  });
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
export function checkUrlForCode(code: string): string {
  return `https://mesita.ai/check/${code}`;
}
