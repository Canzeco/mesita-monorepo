// Mesita Credits charge-readiness — the ONE place this chain is computed,
// mirroring _shared/mesita-pay-readiness.ts (MESITA-1414) so a balance read
// and consumer-web-buy-credits' actual charge attempt can never disagree
// about whether a place is chargeable (MESITA-1676).
//
//   place_profiles.credits_enabled  (operator intent bit)
//   ∧ visits_config.payCredits      (global rail switch)
//   ∧ isConnectChargeReady          (Stripe-derived Connect capability, on
//                                     the PLACE's own account — MESITA-1892)
//
// That is the BUY chain. The SPEND chain is its first two legs only, and it
// lives here too, as placesHonouringCredits (MESITA-2051): spending a balance
// never touches Stripe, so a missing Connect account must not block it.
//
// THE CHAIN USED TO STRADDLE TWO ROWS. `credits_enabled` was the place's,
// while the Connect account hung off the place's ORGANIZATION, so this file
// had to resolve places → organization → account and could return a balance
// scoped to something the caller never named. The org layer is gone
// (MESITA-1892): the account is the place's own row in
// `place_payment_accounts`, so all three facts are now facts about ONE place.
//
// KEYED BY PLACE, AND THE LOT IS THE PLACE'S TOO. A guest reaches Buy from a
// place they know, so the client always has a placeId — that was already
// true. What changed is the other half: `credit_lots.place_id` means the lot
// that results is spendable at THAT venue and nowhere else. The request and
// the debt finally name the same thing, which is why there is no longer a
// distinction here between "how the request is addressed" and "what gets
// written" — the same collapse resolveChargeablePlaceAccount describes for
// the ticket rail.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConnectChargeReady } from "./payment-account-doc.ts";

export type ChargeablePlaceForCredits = {
  placeId: string;
  connectedAccountId: string;
};

/**
 * Resolves the connected Stripe account a Credits purchase at `placeId` would
 * charge through and fund, or null if any leg of the chain is closed.
 * `payCredits` is passed in (from visits_config) rather than read here —
 * mirrors resolveChargeablePlaceAccount's shape exactly.
 */
export async function resolveChargeablePlaceForCredits(
  admin: SupabaseClient,
  payCredits: boolean,
  placeId: string | null,
): Promise<ChargeablePlaceForCredits | null> {
  if (!payCredits || !placeId) return null;
  const place = await admin
    .from("place_profiles")
    .select("credits_enabled")
    .eq("id", placeId)
    .maybeSingle();
  const intent =
    (place.data as { credits_enabled?: boolean } | null)?.credits_enabled ===
      true;
  if (!intent) return null;
  const account = await admin
    .from("place_payment_accounts")
    .select("stripe_account_id, charges_enabled, details_submitted")
    .eq("place_id", placeId)
    .maybeSingle();
  const row = account.data as
    | {
      stripe_account_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }
    | null;
  if (!isConnectChargeReady(row)) return null;
  return { placeId, connectedAccountId: row!.stripe_account_id };
}

// ── The batched form of the SAME chain ────────────────────────────────────
//
// MESITA-1674 asked "does an organization take Credits — any place? all? a
// new column?" and this file answered ANY, because `credits_enabled` was
// place-scoped and organizations had no capability bit of their own. That
// question no longer exists: with the org layer gone (MESITA-1892) there is
// nothing above a place to aggregate to, so "does this place take Credits"
// is the only question left and every leg of it lives on that place's own
// rows. placesAcceptingCredits is therefore not a different rule from
// resolveChargeablePlaceForCredits — it is the same three legs, evaluated
// for a list, which is what keeps the Buy picker and the charge attempt from
// drifting into different answers (the exact unenforced-config bug root
// CLAUDE.md names).
//
// BATCHED, NOT ONE ROUND TRIP PER PLACE. consumer-web-list-credit-balances
// calls this once per page of places (bounded by DEFAULT_PAGE_SIZE), never
// once per lot.

/**
 * Which of `placeIds` currently accept a NEW Credits purchase — the place's
 * own `credits_enabled` bit AND its own Connect account being charge-ready.
 * `payCredits` is passed in (from visits_config) rather than read here,
 * mirroring every other resolver in this file.
 */
export async function placesAcceptingCredits(
  admin: SupabaseClient,
  placeIds: readonly string[],
  payCredits: boolean,
): Promise<ReadonlySet<string>> {
  if (!payCredits || placeIds.length === 0) return new Set();

  const acceptors = await admin
    .from("place_profiles")
    .select("id, credits_enabled")
    .in("id", placeIds)
    .eq("credits_enabled", true);
  if (acceptors.error) return new Set();
  const acceptingPlaceIds = ((acceptors.data ?? []) as { id: string }[]).map(
    (r) => r.id,
  );
  if (acceptingPlaceIds.length === 0) return new Set();

  const accounts = await admin
    .from("place_payment_accounts")
    .select("place_id, stripe_account_id, charges_enabled, details_submitted")
    .in("place_id", acceptingPlaceIds);
  if (accounts.error) return new Set();

  const ready = new Set<string>();
  for (
    const row of (accounts.data ?? []) as {
      place_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }[]
  ) {
    if (isConnectChargeReady(row)) ready.add(row.place_id);
  }
  return ready;
}

// ── Honouring, not accepting: the SPEND chain (MESITA-2051) ────────────────
//
// TWO QUESTIONS, TWO FUNCTIONS. placesAcceptingCredits answers "can a guest
// BUY Credits here today": intent bit, rail switch AND a charge-ready Connect
// account, because a purchase is a charge. Spending a balance the guest
// already holds never touches Stripe, so the spend gate is the first two legs:
//
//   visits_config.payCredits  (Lake 2 issuer rule, MESITA-2052)
//
// `credits_enabled` gates NEW purchases only (placesAcceptingCredits). A place
// that turned Credits off still honours balances it already sold (G4).
//
// consumer-web-apply-ticket-credits used to carry this rule inline, and it
// read a FAILED query as "not accepted": a database blip answered a guest at
// the table with a false 409 "Credits aren't accepted here." This returns
// ok:false instead, never a silent empty set, so each caller says what a
// failed lookup means (the spend EF answers 500 credits_honour_lookup).
//
// MESITA-2052 (Pato, 2026-09-22): a place always honours Credits it already
// sold; turning Credits off stops new sales only. That lands with the Pay
// step, as an issuer rule HERE, not as a second copy of the rule elsewhere.

export type HonourLookup =
  | { ok: true; honoured: ReadonlySet<string> }
  | { ok: false; error: string };

/**
 * Which of `placeIds` honour Credits right now: `payCredits` on AND the place
 * row exists. No Connect leg; no `credits_enabled` leg (issuer rule, G4).
 * `payCredits` is passed in (from visits_config), like every resolver here.
 */
export async function placesHonouringCredits(
  admin: SupabaseClient,
  placeIds: readonly string[],
  payCredits: boolean,
): Promise<HonourLookup> {
  if (!payCredits || placeIds.length === 0) {
    return { ok: true, honoured: new Set() };
  }
  const res = await admin
    .from("place_profiles")
    .select("id")
    .in("id", [...placeIds]);
  if (res.error) return { ok: false, error: res.error.message };
  const honoured = new Set<string>();
  for (const row of (res.data ?? []) as { id: string }[]) {
    honoured.add(row.id);
  }
  return { ok: true, honoured };
}

/**
 * The ISO 4217 currency a Credits charge at this place is priced in,
 * uppercased for Stripe, or NULL when the query itself failed.
 *
 * Lives beside resolveChargeablePlaceForCredits for the same reason that
 * function exists: buy and gift both charge the same place, and the two must
 * never disagree about it. They each carried this query.
 *
 * A FAILED READ IS NOT "MXN". Blank or absent falls back to MXN — the
 * market's currency and the column's own default — because that is a real
 * answer about a real row. A PostgREST error is not an answer at all, and
 * guessing a denomination is guessing what the guest's card gets charged in,
 * so this returns null and the caller refuses the purchase. `currency` moved
 * from `organizations` to the doored `places` table with the org layer
 * (MESITA-1892); read-surface.test.ts is what insisted the difference be
 * visible here, for exactly the reason MESITA-1712 cost.
 */
export async function resolvePlaceCurrency(
  admin: SupabaseClient,
  placeId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("places")
    .select("currency")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return null;
  const currency = (data as { currency?: string | null } | null)?.currency;
  return currency && currency.trim() ? currency.toUpperCase() : "MXN";
}
