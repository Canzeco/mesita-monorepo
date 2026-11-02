// Mesita Premier (MESITA-3092; Premier MESITA-2925, Boost MESITA-2789,
// Spotlight MESITA-1998): a place has at most ONE Paid subscription. Anyone
// signed in buys it when none runs; the guest who pays changes the plan,
// updates the card, stops renewing or resumes. A declined renewal ends it.
// Mesita's Manual Premier (MESITA-3091) is apart: levels it already gives
// are not for sale. Every amount and date here comes from the server
// (consumer-web-get-premier's `quotes`): this file never computes money. The
// wire keeps its Boost names (the EFs, the `boost_*` tiers).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BoostTier = "boost_2x" | "boost_5x";
export type BoostInterval = "month" | "year";
export type TierRank = 1 | 2;

/** The two plans (10X retired, MESITA-3041; named MESITA-3063): each sells
 *  what the place gets, and `priority` is the factor the ranking applies
 *  (Home's list and the Map). Prices come from the server's quotes. */
export const BOOST_TIERS = [
  {
    key: "boost_2x",
    rank: 1,
    label: "Premier",
    priority: "2X",
    blurb: "Moves the place up on Home and the Map",
  },
  {
    key: "boost_5x",
    rank: 2,
    label: "Premier Max",
    priority: "5X",
    blurb: "The biggest lift on Home and the Map",
  },
] as const satisfies ReadonlyArray<{
  key: BoostTier;
  rank: TierRank;
  label: string;
  priority: string;
  blurb: string;
}>;

export const BOOST_TIER_LABEL: Record<number, string | null> = {
  0: null,
  1: "Premier",
  2: "Premier Max",
};

/** A tier's plan name ("Premier Max"); a tier this build does not know
 *  reads plain "Premier", never `undefined` (MESITA-3041). */
export function tierLabel(tier: number): string {
  return BOOST_TIER_LABEL[tier] ?? "Premier";
}

export type BoostQuote = {
  price_cents: number;
  charge_cents: number;
  credit_cents: number;
  extra_days: number;
  new_ends_at: string | null;
  /** When the new terms are first charged, when they wait for the running
   *  period's end (a change down, or a resume). */
  renews_at: string | null;
  kind: "buy" | "change" | "resume" | "blocked";
  blocked_by: "taken" | "charging" | null;
  checkout: "payment" | "setup" | "none";
  /** Mesita's Manual Premier already gives this level or more: not for
   *  sale (MESITA-3091). */
  covered: boolean;
};

/** Who the guest is to this place's Premier. */
export type PremierViewer = "payer" | "former_payer" | "stranger";

export type MyPledge = {
  id: string;
  tier: number;
  interval: BoostInterval;
  /** ready = the place's subscription (you pay); open = a Checkout. */
  status: "open" | "ready";
  pending: number | null;
  has_card: boolean;
  checkout: "buy" | "change" | "resume" | "update_card" | null;
};

export type EndedNotice = {
  reason: "declined" | "stopped_by_place" | "taken_over" | "covered";
  at: string;
  runs_until: string | null;
  refund_cents: number;
};

/** What a Checkout came to (consumer-web-get-premier with `session_id`). */
export type BoostOutcome =
  | "confirmed"
  | "saved"
  | "lost"
  | "declined"
  | "covered"
  | "pending"
  | "expired"
  | "none";

export type PlaceBoost = {
  tier: 0 | 1 | 2 | 3;
  /** Manual Premier: Mesita's free lift running now (MESITA-3091). */
  manual: { tier: number; ends_at: string } | null;
  /** The Paid period running now. */
  paid: {
    tier: number;
    ends_at: string;
    renews: boolean;
    by_you: boolean;
  } | null;
  renewing: boolean;
  viewer: PremierViewer | null;
  can_resume: boolean;
  mine: MyPledge | null;
  ended_notice: EndedNotice | null;
  quotes: Record<BoostTier, Record<BoostInterval, BoostQuote>> | null;
  outcome?: BoostOutcome;
};

/** What a refused start means, in one line (the server's `code`). */
export const START_REFUSED: Record<string, string> = {
  covered_by_mesita:
    "Mesita already gives this place that level. Your card was not charged.",
  premier_taken: "Someone else pays for Premier here.",
  charging: "A renewal is being charged. Try again in a few minutes.",
  not_payer: "Only the guest who pays can update the card.",
  lost: "Premier changed while you were choosing. Look again.",
};

export async function apiGetBoost(
  client: SupabaseClient,
  placeId: string,
  sessionId?: string,
): Promise<PlaceBoost> {
  return await invokeEF<PlaceBoost>(client, "consumer-web-get-premier", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** Buys, changes or resumes the place's Premier, or (`updateCard`) replaces
 *  the payer's card. Resolves to the Checkout page to send the guest to, or
 *  null when nothing needed Checkout. A refusal throws an EFError whose
 *  `code` is a START_REFUSED key. */
export async function apiStartBoost(
  client: SupabaseClient,
  input:
    | {
        placeId: string;
        tier: BoostTier;
        interval: BoostInterval;
        returnUrl: string;
      }
    | { placeId: string; updateCard: true; returnUrl: string },
): Promise<{ url: string | null; outcome?: "updated" | "confirmed" }> {
  return await invokeEF<{
    url: string | null;
    outcome?: "updated" | "confirmed";
  }>(
    client,
    "consumer-web-start-premier",
    "updateCard" in input
      ? {
          place_id: input.placeId,
          kind: "update_card",
          return_url: input.returnUrl,
        }
      : {
          place_id: input.placeId,
          tier: input.tier,
          interval: input.interval,
          return_url: input.returnUrl,
        },
  );
}

/** Stops renewing: the period already paid runs out, nothing more is
 *  charged, the saved card is removed. */
export async function apiCancelBoost(
  client: SupabaseClient,
  placeId: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-cancel-premier", {
    place_id: placeId,
  });
}

/** Hides the notice of the guest's ended subscription on this place. */
export async function apiDismissPremierNotice(
  client: SupabaseClient,
  placeId: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(
    client,
    "consumer-web-dismiss-premier-notice",
    { place_id: placeId },
  );
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** "$45.00". */
export function money(cents: number): string {
  return USD.format(cents / 100);
}

/** "Nov 14". */
export function shortDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
