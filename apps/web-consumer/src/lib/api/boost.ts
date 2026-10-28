// Mesita Premier (MESITA-2925; Boost from MESITA-2789, Spotlight from
// MESITA-1998): anyone makes a place Premier from its Premier tab, with
// their own Stripe subscription. Many guests may back one place; the place
// holds the highest tier their live backings pay for together, shown as
// Premier 2X · 5X · 10X. The wire keeps its Boost names (the EFs, the
// `boost_*` tiers); only the words a guest reads changed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BoostTier = "boost_2x" | "boost_5x" | "boost_10x";
export type BoostInterval = "month" | "year";

/** Prices in US dollars a month. The server charges its own copy
 *  (supabase/.../_shared/boost.ts); these are only the labels. A year is
 *  billed as ten months. */
export const BOOST_TIERS = [
  {
    key: "boost_2x",
    label: "Premier 2X",
    monthly: 10,
    blurb: "Twice as likely to show on the Map and Home",
  },
  {
    key: "boost_5x",
    label: "Premier 5X",
    monthly: 50,
    blurb: "Five times as likely to show",
  },
  {
    key: "boost_10x",
    label: "Premier 10X",
    monthly: 200,
    blurb: "Ten times as likely to show, the most there is",
  },
] as const satisfies ReadonlyArray<{ key: BoostTier; label: string; monthly: number; blurb: string }>;

export const BOOST_YEAR_MONTHS = 10;

export const BOOST_TIER_LABEL: Record<0 | 1 | 2 | 3, string | null> = {
  0: null,
  1: "Premier 2X",
  2: "Premier 5X",
  3: "Premier 10X",
};

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "$10/mo" or "$100/yr" (ten months). */
export function boostPrice(monthly: number, interval: BoostInterval): string {
  return interval === "year"
    ? `${USD.format(monthly * BOOST_YEAR_MONTHS)}/yr`
    : `${USD.format(monthly)}/mo`;
}

export type MyBacking = {
  id: string;
  tier: BoostTier;
  interval: BoostInterval;
  amount_cents: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  live: boolean;
};

export type PlaceBoost = {
  tier: 0 | 1 | 2 | 3;
  backers: number;
  mine: MyBacking[];
  confirmed?: boolean;
};

export async function apiGetBoost(
  client: SupabaseClient,
  placeId: string,
  sessionId?: string,
): Promise<PlaceBoost> {
  return await invokeEF<PlaceBoost>(client, "consumer-web-get-boost", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** Opens Stripe Checkout; resolves to the page to send the guest to. */
export async function apiStartBoost(
  client: SupabaseClient,
  input: {
    placeId: string;
    tier: BoostTier;
    interval: BoostInterval;
    returnUrl: string;
  },
): Promise<string> {
  const res = await invokeEF<{ url: string }>(client, "consumer-web-start-boost", {
    place_id: input.placeId,
    tier: input.tier,
    interval: input.interval,
    return_url: input.returnUrl,
  });
  return res.url;
}

/** Stops renewing one of the guest's own backings; it stays live to the
 *  end of the period already paid. */
export async function apiCancelBoost(
  client: SupabaseClient,
  backingId: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-cancel-boost", {
    backing_id: backingId,
  });
}
