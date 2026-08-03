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


// ── Guest tasks on a live ticket (MESITA-824, v3 in MESITA-849) ─────────
//
// The guest completes these BEFORE staff are involved and their tap IS the
// verification — the ticket lands on `self_verified` and, if the bill is
// already in, re-prices immediately. No screenshot: there was never anything
// that could check one (the old placeholder URL went to a staff verdict that
// no longer exists), and pretending otherwise cost the guest an upload for a
// human coin-flip.
//
// `repricedPercent` is non-null only when the task beat an already-snapshotted
// discount — the caller can surface "your discount just went up".
export async function apiSubmitStory(
  ticketId: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    supabase,
    'consumer-web-submit-story',
    { ticketId },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

export async function apiSubmitReview(
  ticketId: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    supabase,
    'consumer-web-submit-review',
    { ticketId },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
export function checkUrlForCode(code: string): string {
  return `https://mesita.ai/check/${code}`;
}
