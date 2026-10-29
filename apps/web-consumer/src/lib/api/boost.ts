// Mesita Premier (MESITA-2995; Premier MESITA-2925, Boost MESITA-2789,
// Spotlight MESITA-1998): anyone pledges for a place's Premier from its
// Premier tab. Many guests may pledge; only the top pledge is charged each
// period and the rest are backups, charged only if the pledges above them
// stop paying. Upgrading takes the unused days of the running period off
// the new price. Every amount and position here comes from the server
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
  role: "payer" | "backup";
  position: number;
  checkout: "payment" | "setup" | "none";
};

export type LineRow = {
  tier: number;
  interval: BoostInterval;
  role: "payer" | "backup";
  position: number;
  mine: boolean;
  /** "You", @handle or a first name (MESITA-3063); never an email. */
  name: string;
};

export type MyPledge = {
  id: string;
  tier: number;
  interval: BoostInterval;
  status: "open" | "ready" | "failed" | "ended";
  role: "payer" | "backup";
  position: number;
  pending: number | null;
  has_card: boolean;
};

export type BoostOutcome =
  | "confirmed"
  | "saved_as_backup"
  | "released_stale"
  | "pending"
  | "expired"
  | "none";

export type PlaceBoost = {
  tier: 0 | 1 | 2 | 3;
  period: {
    tier: number;
    ends_at: string;
    granted: boolean;
    renews: boolean;
  } | null;
  renewing: boolean;
  line: LineRow[];
  more: number;
  mine: MyPledge | null;
  quotes: Record<BoostTier, Record<BoostInterval, BoostQuote>> | null;
  outcome?: BoostOutcome;
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

/** Pledges (or changes the guest's pledge). Resolves to the Checkout page
 *  to send the guest to, or null when nothing needed Checkout. */
export async function apiStartBoost(
  client: SupabaseClient,
  input: {
    placeId: string;
    tier: BoostTier;
    interval: BoostInterval;
    returnUrl: string;
  },
): Promise<{ url: string | null; outcome?: "updated" | "confirmed" }> {
  return await invokeEF<{
    url: string | null;
    outcome?: "updated" | "confirmed";
  }>(client, "consumer-web-start-premier", {
    place_id: input.placeId,
    tier: input.tier,
    interval: input.interval,
    return_url: input.returnUrl,
  });
}

/** Leaves the line. A payer keeps the period already paid. */
export async function apiCancelBoost(
  client: SupabaseClient,
  backingId: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-cancel-premier", {
    backing_id: backingId,
  });
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
