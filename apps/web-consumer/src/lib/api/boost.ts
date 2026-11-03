// Mesita Premier on the place screen (MESITA-3168; Premier MESITA-2925,
// Boost MESITA-2789, Spotlight MESITA-1998): any signed-in guest buys a
// Premier Refill pack for a place — 30 days of Pro (Premier 2X) or Max
// (Premier 5X), paid once, no renewal and no owner check. The recurring Premier
// Subscription is the Business app's. Every amount, date and line here comes
// from the server (consumer-web-get-premier-refill): this file never
// computes money. Tier on the wire is the integer 1 = 2X, 2 = 5X.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type TierRank = 1 | 2;

/** The two packs (named Pro and Max, MESITA-3174): each sells what the place gets, and
 *  `priority` is the factor the ranking applies (Home's list and the Map).
 *  Prices come from the server. */
export const BOOST_TIERS = [
  {
    rank: 1,
    label: "Pro",
    priority: "Premier 2X",
    blurb: "Moves the place up on Home and the Map",
  },
  {
    rank: 2,
    label: "Max",
    priority: "Premier 5X",
    blurb: "The biggest lift on Home and the Map",
  },
] as const satisfies ReadonlyArray<{
  rank: TierRank;
  label: string;
  priority: string;
  blurb: string;
}>;

export const BOOST_TIER_LABEL: Record<number, string | null> = {
  0: null,
  1: "Premier 2X",
  2: "Premier 5X",
};

/** A tier's level ("Premier 5X"); a tier this build does not know
 *  reads plain "Premier", never `undefined` (MESITA-3041). */
export function tierLabel(tier: number): string {
  return BOOST_TIER_LABEL[tier] ?? "Premier";
}

export type RefillPack = {
  tier: TierRank;
  days: number;
  price_cents: number;
  currency: string;
  /** False when the place can't take this pack now (`code` says why). */
  available: boolean;
  code?: string;
  /** The place already runs at or above this tier: buying keeps it there. */
  notice?: string;
};

/** Refill days running or queued: who gave them (Mesita, a code, a guest). */
export type RefillDays = {
  tier: number;
  starts_at: string;
  ends_at: string;
  source: "admin" | "code" | "purchase";
};

export type PurchaseStatus =
  "open" | "expired" | "paid" | "granted" | "refunded" | "refund_needed";

/** What a Checkout came to (consumer-web-get-premier-refill with
 *  `session_id`), with the server's one line for the guest. */
export type RefillPurchase = {
  status: PurchaseStatus;
  line: string;
  tier: number;
  ends_at: string | null;
};

export type PlaceBoost = {
  level: 0 | 1 | 2;
  signed_in: boolean;
  refill: RefillDays[];
  /** The place's own Subscription period running now (Business app). */
  subscription: { tier: number; ends_at: string } | null;
  packs: RefillPack[];
  purchase?: RefillPurchase | null;
};

/** What a refused pack means, in one line (the server's `code`). */
export const START_REFUSED: Record<string, string> = {
  not_found: "This place isn't on Mesita yet.",
  archived: "This place is closed on Mesita.",
  unlisted: "This place is hidden on Mesita right now.",
  paid_higher: "This place's own plan is already higher.",
  cap_reached: "This place has a year of Premier days queued already.",
  stripe_unavailable: "Payments are not available right now.",
};

export async function apiGetBoost(
  client: SupabaseClient,
  placeId: string,
  sessionId?: string,
): Promise<PlaceBoost> {
  return await invokeEF<PlaceBoost>(client, "consumer-web-get-premier-refill", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** Opens Checkout for a pack. Resolves to the Checkout page to send the
 *  guest to. A refusal throws an EFError whose `code` is a START_REFUSED
 *  key. */
export async function apiStartRefill(
  client: SupabaseClient,
  input: { placeId: string; tier: TierRank; returnUrl: string },
): Promise<{ url: string; notice?: string }> {
  return await invokeEF<{ url: string; notice?: string }>(
    client,
    "consumer-web-start-premier-refill",
    {
      place_id: input.placeId,
      tier: input.tier,
      return_url: input.returnUrl,
    },
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
