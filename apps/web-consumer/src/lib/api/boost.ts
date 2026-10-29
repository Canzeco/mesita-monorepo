// Mesita Premier (MESITA-2995; Premier MESITA-2925, Boost MESITA-2789,
// Spotlight MESITA-1998): anyone pledges for a place's Premier from its
// Premier tab. Many guests may pledge; only the top pledge is charged each
// period and the rest are backups, charged only if the pledges above them
// stop paying. Upgrading takes the unused days of the running period off
// the new price. Every amount and position here comes from the server
// (consumer-web-get-boost's `quotes`): this file never computes money. The
// wire keeps its Boost names (the EFs, the `boost_*` tiers).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BoostTier = "boost_2x" | "boost_5x" | "boost_10x";
export type BoostInterval = "month" | "year";
export type TierRank = 1 | 2 | 3;

/** The three levels, labels only: prices come from the server's quotes. */
export const BOOST_TIERS = [
  { key: "boost_2x", rank: 1, mark: "2X", label: "Premier 2X", blurb: "Twice as likely to show on the Map and Home" },
  { key: "boost_5x", rank: 2, mark: "5X", label: "Premier 5X", blurb: "Five times as likely to show" },
  { key: "boost_10x", rank: 3, mark: "10X", label: "Premier 10X", blurb: "Ten times as likely to show, the most there is" },
] as const satisfies ReadonlyArray<{ key: BoostTier; rank: TierRank; mark: string; label: string; blurb: string }>;

export const BOOST_TIER_LABEL: Record<0 | 1 | 2 | 3, string | null> = {
  0: null,
  1: "Premier 2X",
  2: "Premier 5X",
  3: "Premier 10X",
};

export const TIER_MARK: Record<number, string> = { 1: "2X", 2: "5X", 3: "10X" };

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

export type BoostOutcome = "confirmed" | "saved_as_backup" | "released_stale" | "pending" | "expired" | "none";

export type PlaceBoost = {
  tier: 0 | 1 | 2 | 3;
  period: { tier: number; ends_at: string; granted: boolean; renews: boolean } | null;
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
  return await invokeEF<PlaceBoost>(client, "consumer-web-get-boost", {
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
  return await invokeEF<{ url: string | null; outcome?: "updated" | "confirmed" }>(client, "consumer-web-start-boost", {
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
  await invokeEF<Record<string, never>>(client, "consumer-web-cancel-boost", {
    backing_id: backingId,
  });
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$45.00". */
export function money(cents: number): string {
  return USD.format(cents / 100);
}

/** "Nov 14". */
export function shortDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
