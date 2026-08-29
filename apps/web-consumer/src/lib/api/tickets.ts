// Consumer ticket API — Tickets v2 self-check-in (MESITA-806).
//
// The Rewards New/History tabs are TICKET-driven (consumer-web-list-tickets),
// not notification-driven: a just-created ticket must be visible immediately,
// QR and all. Notifications stay as the bill push/poll signal
// (lib/api/notifications.ts) — tickets are the state, notifications the event.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegacyClassKey } from "@/lib/consumer-data";
import { invokeEF } from "./_invoke";

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
  // THE TICKET v4 (MESITA-1088+): the seven-step journey state. Optional so
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
// in a bucket no UI renders; `ticket-status-drift.test.ts` pins all three
// copies (supabase · web · mobile) to each other.
export const ACTIVE_TICKET_STATUSES = new Set([
  "open",
  "scanned",
  "approved",
  "paying",
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

// Exported for the seed cache (MESITA-1029 S3): NewVisitClient synthesizes a
// ConsumerTicketRow out of this + the tapped Place so THE TICKET paints
// without waiting for list-tickets. The EF returns the full inserted row —
// these optional fields were simply under-declared before the seed needed
// them.
export type CreatedTicket = {
  id: string;
  status: string;
  story_status?: string | null;
  review_status?: string | null;
  first_scanned_at?: string | null;
  currency?: string | null;
  created_at?: string;
  check_code: string;
  place_name: string | null;
  place_slug: string | null;
};

// Pick-one (D6): the ONE action that gates the QR. The EF opens the chosen
// action at 'pending', leaves the other 'not_required', and 'base' opens no
// task at all. wantsStory is derived server-side from the choice.
export type ChosenReward = "story" | "review" | "base";

export async function apiCreateTicket(
  client: SupabaseClient,
  placeId: string,
  chosenReward: ChosenReward,
): Promise<{ ticket: CreatedTicket; checkUrl: string }> {
  return await invokeEF<{ ticket: CreatedTicket; checkUrl: string }>(
    client,
    "consumer-web-create-ticket",
    { placeId, chosenReward },
  );
}

// The guest's REAL reward breakdown for one place, resolved by the live engine
// config (MESITA-992 v10 additive). `reward-segments.ts` is the PROGRAM ladder
// — education about the shape of the program — and its static numbers stopped
// matching the bill when v10 shipped. Anything that quotes a guest a rate for a
// SPECIFIC place must use this, never the static table.
export type RewardQuote = {
  strategy: "zero" | "conservative" | "aggressive" | "dominant";
  classKey: string;
  /** False = engine is still on legacy best-of; the client must not stack. */
  additive: boolean;
  isFirstVisit: boolean;
  base: number;
  /** `welcome` already reports 0 when this isn't the guest's first visit. */
  bonuses: { welcome: number; story: number; google: number; mesita: number };
  /**
   * EVERY class's standing rate at this place (MESITA-1068) — the program's
   * public shape, from the same live config that prices the bill, so the
   * Rewards tab never reconstructs it from the static CLASS_STEP ladder.
   *
   * KEYED BY THE FOUR LEGACY SEGMENTS for the best-of fallback. v11 quotes
   * carry `breakdown.classes` instead — Bronze · Silver · Gold · Diamond
   * standing rates, so Gold is a priced rung, not a star.
   *
   * Optional only to survive the deploy window where a cached client meets a
   * not-yet-redeployed EF; treat absent as "don't render the ladder", never
   * as a reason to fall back to local arithmetic.
   */
  ladder?: Partial<Record<LegacyClassKey, number>>;
  /**
   * THE TICKET v4's Reward lanes (MESITA-1089): the base decomposed on the
   * SAME v11 grid the bill pays — automatic = the bronze·free floor, each
   * class chip = that class's free-plan rate over the floor, planUplift =
   * the caller's own premium delta. automatic + classes[cls] + (plan ===
   * "premium" ? planUplift : 0) === base, by construction. Absent on legacy
   * best-of configs and on stale EFs — render the flat receipt then.
   */
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
  client: SupabaseClient,
  placeId: string,
): Promise<{ quote: RewardQuote }> {
  return await invokeEF<{ quote: RewardQuote }>(
    client,
    "consumer-web-get-discount-quote",
    { placeId },
  );
}

/**
 * The same quote for MANY places in one round trip (MESITA-1019).
 *
 * The promo chip renders on four surfaces and every one of them used to read
 * the four v4 rate columns as prices. Routing it through the engine is the
 * fix; doing that per card would have turned a deck into a deck of requests.
 * Ids the server doesn't know are simply absent from the map — the caller
 * renders nothing rather than a fabricated rate.
 */
export async function apiGetRewardQuotes(
  client: SupabaseClient,
  placeIds: string[],
): Promise<Record<string, RewardQuote>> {
  if (placeIds.length === 0) return {};
  const res = await invokeEF<{ quotes: Record<string, RewardQuote> }>(
    client,
    "consumer-web-get-discount-quote",
    { placeIds },
  );
  return res.quotes ?? {};
}

export async function apiCancelTicket(
  client: SupabaseClient,
  ticketId: string,
): Promise<void> {
  await invokeEF<{ ticket?: unknown }>(client, "consumer-web-cancel-ticket", {
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
  client: SupabaseClient,
  ticketId: string,
  /** Public ticket-proofs URL (MESITA-1030) — the screenshot IS the proof. */
  screenshotUrl?: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    client,
    "consumer-web-submit-story",
    { ticketId, screenshotUrl },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

export async function apiSubmitReview(
  client: SupabaseClient,
  ticketId: string,
  /** Public ticket-proofs URL (MESITA-1030) — the screenshot IS the proof. */
  screenshotUrl?: string,
): Promise<{ repricedPercent: number | null }> {
  const res = await invokeEF<{ repricedPercent?: number | null }>(
    client,
    "consumer-web-submit-review",
    { ticketId, screenshotUrl },
  );
  return { repricedPercent: res.repricedPercent ?? null };
}

// THE TICKET v4, step 1 (MESITA-1088): the guest's bill + tip. The tip
// crosses the wire as the preset percent OR a custom peso amount — never as
// client-computed cents (C4); the EF prices everything server-side.
export async function apiSubmitTicketBill(
  client: SupabaseClient,
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
  }>(client, "consumer-web-submit-ticket-bill", {
    ticketId,
    subtotalCents: bill.subtotalCents,
    tipPct: bill.tipPct,
    ...(bill.tipPct === null
      ? { tipCustomCents: bill.tipCustomCents ?? 0 }
      : {}),
  });
}

// THE TICKET v4 live sync (MESITA-1091): one owner-scoped row, polled at
// visits.consumerPollSeconds while the ticket screen is mounted. Realtime
// stays off `tickets` on purpose — this poll IS the design.
export type GuestVisitsPolicy = {
  tipEnabled: boolean;
  tipPresets: number[];
  defaultTipPct: number;
  consumerPollSeconds: number;
  reportEnabled: boolean;
};

/** Per-ticket settlement availability, derived server-side. */
export type TicketSettlement = {
  /** Mesita Pay is usable on THIS ticket: places.mesita_pay_enabled ∧
   *  visits_config.payCard ∧ Connect charge-readiness. One derived boolean —
   *  the legs stay server-side (mesita_pay_enabled is an admin-only fact). */
  cardRail: boolean;
};

export async function apiGetTicket(
  client: SupabaseClient,
  ticketId: string,
): Promise<{
  ticket: ConsumerTicketRow;
  visits?: GuestVisitsPolicy;
  settlement?: TicketSettlement;
}> {
  return await invokeEF<{
    ticket: ConsumerTicketRow;
    visits?: GuestVisitsPolicy;
    settlement?: TicketSettlement;
  }>(client, "consumer-web-get-ticket", { ticketId });
}

// THE TICKET v4, step 5 (MESITA-1092): after approval the guest picks how
// they settle. `at_place` is the ONE live path. Mesita Pay (the card rail) is
// staged, not live: the Connect account layer landed in #1415 and the charge
// path is still to come, so this door still accepts only `at_place`. The
// gateway PR is the one that reopens it with a new method value.
export async function apiSelectTicketPayment(
  client: SupabaseClient,
  ticketId: string,
  method: "at_place" | null,
): Promise<{ status: string }> {
  return await invokeEF<{ status: string }>(
    client,
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
  client: SupabaseClient,
  ticketId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  await invokeEF<{ report?: unknown }>(client, "consumer-web-report-ticket", {
    ticketId,
    reason,
    ...(details?.trim() ? { details: details.trim() } : {}),
  });
}

// The QR every active ticket renders — must match the EF's CHECK_URL_BASE.
const CHECK_ORIGIN = "https://check.mesita.ai";
export function checkUrlForCode(code: string): string {
  return `${CHECK_ORIGIN}/${code}`;
}
