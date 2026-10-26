// Spotlight (MESITA-1998): anyone backs a place's paid tier from its three
// dots, with their own Stripe subscription. Many guests may back one place;
// the place holds the highest tier their live backings pay for together.
// Paid, never verified, never Selected.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type SpotlightTier = "spotlight" | "spotlight_plus";
export type SpotlightInterval = "month" | "year";

/** Prices in US dollars a month. The server charges its own copy
 *  (supabase/.../_shared/spotlight.ts); these are only the labels. */
export const SPOTLIGHT_TIERS = [
  {
    key: "spotlight",
    label: "Spotlight",
    monthly: 10,
    blurb: "Shows up more often on the Map and Home",
  },
  {
    key: "spotlight_plus",
    label: "Spotlight Plus",
    monthly: 100,
    blurb: "Shows up the most, ahead of Spotlight",
  },
] as const satisfies ReadonlyArray<{ key: SpotlightTier; label: string; monthly: number; blurb: string }>;

export const SPOTLIGHT_TIER_LABEL: Record<0 | 1 | 2, string | null> = {
  0: null,
  1: "Spotlight",
  2: "Spotlight Plus",
};

export function spotlightPrice(monthly: number, interval: SpotlightInterval): string {
  return interval === "year" ? `$${(monthly * 12).toLocaleString("en-US")}/yr` : `$${monthly}/mo`;
}

export type MyBacking = {
  id: string;
  tier: SpotlightTier;
  interval: SpotlightInterval;
  amount_cents: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  live: boolean;
};

export type PlaceSpotlight = {
  tier: 0 | 1 | 2;
  backers: number;
  names: string[];
  mine: MyBacking[];
  confirmed?: boolean;
};

export async function apiGetSpotlight(
  client: SupabaseClient,
  placeId: string,
  sessionId?: string,
): Promise<PlaceSpotlight> {
  return await invokeEF<PlaceSpotlight>(client, "consumer-web-get-spotlight", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** Opens Stripe Checkout; resolves to the page to send the guest to. */
export async function apiStartSpotlight(
  client: SupabaseClient,
  input: {
    placeId: string;
    tier: SpotlightTier;
    interval: SpotlightInterval;
    showName: boolean;
    returnUrl: string;
  },
): Promise<string> {
  const res = await invokeEF<{ url: string }>(client, "consumer-web-start-spotlight", {
    place_id: input.placeId,
    tier: input.tier,
    interval: input.interval,
    show_name: input.showName,
    return_url: input.returnUrl,
  });
  return res.url;
}

/** Stops renewing one of the guest's own backings; it stays live to the
 *  end of the period already paid. */
export async function apiCancelSpotlight(
  client: SupabaseClient,
  backingId: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-cancel-spotlight", {
    backing_id: backingId,
  });
}
