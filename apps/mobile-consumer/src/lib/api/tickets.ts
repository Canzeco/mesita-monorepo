// Consumer ticket API — Tickets v2 self-check-in (MESITA-806). Mirror of
// apps/web-consumer/src/lib/api/tickets.ts (mobile passes the singleton
// client per this package's api convention).

import { invokeEF } from "@/lib/ef";
import { supabase } from "@/lib/supabase";

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
  bill_subtotal_cents: number | null;
  total_cents: number | null;
  discount_percent: number | null;
  discount_cents: number | null;
  /** Who supplied the recorded amount (MESITA-850): 'business' | 'consumer'
   *  | null (no amount on record). */
  bill_source: string | null;
  // THE TICKET v4 (MESITA-1094): the seven-step journey state. Optional so
  // a cached bundle survives the deploy window where the EF predates them.
  tip_cents?: number | null;
  tip_pct?: number | null;
  approved_at?: string | null;
  approved_discount_cents?: number | null;
  approved_amount_due_cents?: number | null;
  fix_requested?: string | null;
  fix_note?: string | null;
  paid_method?: string | null;
  validated_at?: string | null;
  updated_at?: string;
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
  "open",
  "scanned",
  "approved",
  "paying",
  "awaiting_payment_confirm",
]);

export async function apiListConsumerTickets(
  limit = 50,
): Promise<ConsumerTicketRow[]> {
  const { tickets } = await invokeEF<{ tickets: ConsumerTicketRow[] }>(
    supabase,
    "consumer-web-list-tickets",
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

export type ChosenReward = "story" | "review" | "base";

export async function apiCreateTicket(
  placeId: string,
  chosenReward: ChosenReward = "base",
): Promise<{ ticket: CreatedTicket; checkUrl: string }> {
  return await invokeEF<{ ticket: CreatedTicket; checkUrl: string }>(
    supabase,
    "consumer-web-create-ticket",
    { placeId, chosenReward },
  );
}

export async function apiCancelTicket(ticketId: string): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(supabase, "consumer-web-cancel-ticket", {
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
  /** Public ticket-proofs URL (MESITA-1030) — the screenshot IS the proof. */
  screenshotUrl?: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    supabase,
    "consumer-web-submit-story",
    { ticketId, screenshotUrl },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

export async function apiSubmitReview(
  ticketId: string,
  /** Public ticket-proofs URL (MESITA-1030) — the screenshot IS the proof. */
  screenshotUrl?: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    supabase,
    "consumer-web-submit-review",
    { ticketId, screenshotUrl },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

// The guest's REAL reward breakdown for one place (web parity, MESITA-1094).
// Anything quoting a rate for a SPECIFIC place uses this, never a static
// table — reward-segments.ts is education only.
export type RewardQuote = {
  strategy: "zero" | "conservative" | "aggressive";
  classKey: string;
  additive: boolean;
  isFirstVisit: boolean;
  base: number;
  bonuses: { welcome: number; story: number; google: number; mesita: number };
  /** The Reward lanes' decomposition (MESITA-1089); absent on legacy configs. */
  breakdown?: {
    automatic: number;
    classes: { bronze: number; silver: number; gold: number; diamond: number };
    cls: "bronze" | "silver" | "gold" | "diamond";
    plan: "free" | "premium";
    planUplift: number;
  };
  storyEligible: boolean;
  cap: number;
};

export async function apiGetRewardQuote(
  placeId: string,
): Promise<{ quote: RewardQuote }> {
  return await invokeEF<{ quote: RewardQuote }>(
    supabase,
    "consumer-web-get-reward-quote",
    { placeId },
  );
}

// THE TICKET v4, step 1 (MESITA-1088): the guest's bill + tip. The tip
// crosses the wire as the preset percent OR a custom peso amount — never as
// client-computed cents (C4); the EF prices everything server-side.
export async function apiSubmitTicketBill(
  ticketId: string,
  bill: {
    subtotalCents: number;
    tipPct: number | null;
    tipCustomCents?: number;
  },
): Promise<{ ticket: ConsumerTicketRow; amount_due_cents: number }> {
  return await invokeEF<{
    ticket: ConsumerTicketRow;
    amount_due_cents: number;
  }>(supabase, "consumer-web-submit-ticket-bill", {
    ticketId,
    subtotalCents: bill.subtotalCents,
    tipPct: bill.tipPct,
    ...(bill.tipPct === null
      ? { tipCustomCents: bill.tipCustomCents ?? 0 }
      : {}),
  });
}

// THE TICKET v4 live sync (MESITA-1091): one owner-scoped row, polled at 10s
// while the ticket screen is mounted. Realtime stays off `tickets` on purpose.
export async function apiGetTicket(
  ticketId: string,
): Promise<{ ticket: ConsumerTicketRow }> {
  return await invokeEF<{ ticket: ConsumerTicketRow }>(
    supabase,
    "consumer-web-get-ticket",
    { ticketId },
  );
}

// THE TICKET v4, step 5 (MESITA-1092): after approval the guest picks how
// they settle. at_place is the one live path (C2); null rolls paying back.
export async function apiSelectTicketPayment(
  ticketId: string,
  method: "at_place" | null,
): Promise<{ status: string }> {
  return await invokeEF<{ status: string }>(
    supabase,
    "consumer-web-select-ticket-payment",
    { ticketId, method },
  );
}

// v3c report button (MESITA-851): the guest's route when a place doesn't
// honor the ticket. Live for the whole ticket and for a window after it
// closes — people realise they were shorted once they're outside the venue.
// A report is evidence for an operator, never an automatic strike.
export const REPORT_REASONS = [
  {
    key: "discount_refused",
    label: "They refused the discount",
    hint: "The place wouldn't apply it at the table.",
  },
  {
    key: "closed_without_honoring",
    label: "Closed without honoring it",
    hint: "The ticket was marked done but I got nothing.",
  },
  {
    key: "qr_not_scanned",
    label: "They never scanned the QR",
    hint: "Staff wouldn't scan it at all.",
  },
  { key: "other", label: "Something else", hint: "Tell us what happened." },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export async function apiReportTicket(
  ticketId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  await invokeEF<{ report?: unknown }>(supabase, "consumer-web-report-ticket", {
    ticketId,
    reason,
    ...(details?.trim() ? { details: details.trim() } : {}),
  });
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
export function checkUrlForCode(code: string): string {
  return `https://check.mesita.ai/${code}`;
}
