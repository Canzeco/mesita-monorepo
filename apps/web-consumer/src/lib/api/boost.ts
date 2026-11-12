// Mesita Premier on the place screen (MESITA-3168; Premier MESITA-2925,
// Boost MESITA-2789, Spotlight MESITA-1998): any signed-in guest buys an
// Upgrade for a place (Refill until MESITA-3175, Boost until MESITA-3199) — one year of Premier 2X or
// Premier 5X (MESITA-3386; 3 months until then), paid once, no renewal and no owner check. The recurring Premier
// Subscription is the Business app's. Every amount, date and line here comes
// from the server (consumer-web-get-premier-refill): this file never
// computes money. Tier on the wire is the integer 1 = 2X, 2 = 5X.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type TierRank = 1 | 2;

/** The two Upgrades: each sells what the place gets, and `priority` is the
 *  factor the ranking applies (Home's list and the Map). `plan` is the place
 *  plan with that level (MESITA-3230, Pato: "what you are buying is Mesita Pro
 *  and Mesita Max"): the level is a plan's one perk, so the words are true, but
 *  a guest buys days and never starts a subscription (MESITA-3175). Prices come
 *  from the server. */
export const BOOST_TIERS = [
  {
    rank: 1,
    label: "Upgrade 2X",
    plan: "Pro",
    priority: "Premier 2X",
    blurb: "Moves the place up on Home and the Map",
  },
  {
    rank: 2,
    label: "Upgrade 5X",
    plan: "Max",
    priority: "Premier 5X",
    blurb: "The biggest lift on Home and the Map",
  },
] as const satisfies ReadonlyArray<{
  rank: TierRank;
  label: string;
  plan: string;
  priority: string;
  blurb: string;
}>;

const SUITE_PLAN: Record<number, string> = { 0: "Free", 1: "Pro", 2: "Max" };

/** A level by its plan's name: "Mesita Free", "Mesita Pro", "Mesita Max"
 *  (MESITA-3329, Pato: "don't mention mesita suite pro ... just mention
 *  Mesita Free and Mesita Pro and Mesita Max for clarity"; "Mesita Suite
 *  Pro" from MESITA-3257 until then); a tier this build does not know reads
 *  plain "Mesita", never `undefined` (MESITA-3041). */
export function suitePlanName(tier: number): string {
  const plan = SUITE_PLAN[tier];
  return plan ? `Mesita ${plan}` : "Mesita";
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
  source: "admin" | "purchase";
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
  /** Who runs the place (MESITA-3203), never their name or email. Absent on a
   *  read kept from before it shipped. */
  owner?: "none" | "you" | "other";
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
  cap_reached: "This place has a year of Upgrades queued already.",
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

/** "$45.00": always two decimals (MESITA-3767). */
export function money(cents: number): string {
  return USD.format(Math.round(cents) / 100);
}

/** "Nov 14". */
export function shortDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
