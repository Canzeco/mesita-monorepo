// Consumer ticket API — Tickets v2 self-check-in (MESITA-806). Mirror of
// apps/web-consumer/src/lib/api/tickets.ts (mobile passes the singleton
// client per this package's api convention).

import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

// Mirrors _shared/reservation-places.ts attachPlaces — the EF returns the
// full summary; fields the wallet didn't need were previously under-declared.
type ConsumerTicketPlace = {
  id: string;
  name: string | null;
  photos: string[] | null;
  category?: string | null;
  address?: string | null;
  price_level?: number | null;
  slug?: string | null;
  // The place's v4 preset — THE TICKET quotes THIS place's real rates instead
  // of the static peak (MESITA-869). See lib/promo-rates strategyForPlaceRow.
  listing_type?: string | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
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
  /** Who supplied the recorded amount (MESITA-850): 'business' | 'consumer'
   *  | null (no amount on record). */
  bill_source: string | null;
  currency: string | null;
  created_at: string;
  revealed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  project_id: string;
  place: ConsumerTicketPlace;
};

// MIRROR of LIVE_STATUSES in supabase/supabase/functions/_shared/ticket-status.ts
// (MESITA-1085) — the one status vocabulary. Drift here strands live tickets
// in a bucket no UI renders; web-consumer's `ticket-status-drift.test.ts`
// pins all three copies (supabase · web · mobile) to each other.
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

type CreatedTicket = {
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

// v3b amount fallback (MESITA-850): the staff bill went optional, so when a
// visit closes with no amount on record the guest is asked for the total.
// Unverified by design — the discount was already applied at the place's POS,
// so this is a record for reporting, never a money movement.
export async function apiSubmitTicketTotal(
  ticketId: string,
  totalCents: number,
): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(
    supabase,
    'consumer-web-submit-ticket-total',
    { ticketId, totalCents },
  );
}

// v3c report button (MESITA-851): the guest's route when a place doesn't
// honor the ticket. Live for the whole ticket and for a window after it
// closes — people realise they were shorted once they're outside the venue.
// A report is evidence for an operator, never an automatic strike.
export const REPORT_REASONS = [
  {
    key: 'discount_refused',
    label: 'They refused the discount',
    hint: "The place wouldn't apply it at the table.",
  },
  {
    key: 'closed_without_honoring',
    label: 'Closed without honoring it',
    hint: 'The ticket was marked done but I got nothing.',
  },
  {
    key: 'qr_not_scanned',
    label: 'They never scanned the QR',
    hint: "Staff wouldn't scan it at all.",
  },
  { key: 'other', label: 'Something else', hint: 'Tell us what happened.' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export async function apiReportTicket(
  ticketId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  await invokeEF<{ report?: unknown }>(supabase, 'consumer-web-report-ticket', {
    ticketId,
    reason,
    ...(details?.trim() ? { details: details.trim() } : {}),
  });
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
export function checkUrlForCode(code: string): string {
  return `https://check.mesita.ai/${code}`;
}
