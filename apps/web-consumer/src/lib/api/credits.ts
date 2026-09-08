// Frontend API surface for the real Credits paths: Buy (MESITA-1676) and now
// the Wallet's balance read (MESITA-1674). Gift and Redeem have no real
// backend yet (MESITA-1677) and are parked on their own screens rather than
// wired here — see GiftClient.tsx/RedeemClient.tsx.
//
// consumer-web-buy-credits resolves every money term server-side, so nothing
// here computes a bonus or an expiry that will actually be charged —
// bonusCents/activatesAt/expiresAt in BuyCreditsOutcome are for DISPLAY,
// echoed back from what the server already decided and wrote. The balance
// read below is the same posture the other direction: every cents figure and
// every timestamp in a CreditOrgBalance is exactly what credit_ledger already
// agrees to, nothing recomputed on the client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { TicketPaymentAction } from "@/lib/stripe/confirm-card-action";

export type CreditPurchasePlace = {
  id: string;
  name: string;
};

export async function apiListCreditPlaces(
  client: SupabaseClient,
): Promise<CreditPurchasePlace[]> {
  const res = await invokeEF<{ places: CreditPurchasePlace[] }>(
    client,
    "consumer-web-list-credit-places",
    {},
    "Couldn't load places that accept Mesita Credits.",
  );
  return res.places ?? [];
}

export type BuyCreditsOutcome =
  | {
    state: "purchased";
    lotId?: string;
    mock?: boolean;
    activatesAt: string;
    expiresAt: string;
    bonusCents: number;
  }
  | {
    state: "requires_action";
    requiresAction: TicketPaymentAction;
  };

/**
 * `requestId` must be the SAME string across a retry of the same purchase
 * attempt (a network drop, a double-tap) — it becomes half of the Stripe
 * idempotency key server-side, so a caller that mints a fresh one on every
 * call loses that protection. Callers keep it in component state, not in a
 * module-level counter: a second, independent purchase needs a new one.
 */
export async function apiBuyCredits(
  client: SupabaseClient,
  args: { placeId: string; paidCents: number; requestId: string },
): Promise<BuyCreditsOutcome> {
  return invokeEF<BuyCreditsOutcome>(
    client,
    "consumer-web-buy-credits",
    args,
    "Couldn't complete that purchase.",
  );
}

// ── The Wallet's real balance read (MESITA-1674) ───────────────────────────
// Mirrors supabase/functions/_shared/credits-balances.ts's shapes field for
// field — this is the wire contract, not a second definition of it.

export type CreditLot = {
  lotId: string;
  paidCents: number;
  bonusCents: number;
  spentCents: number;
  remainingCents: number;
  activatesAt: string;
  expiresAt: string;
  createdAt: string;
  pending: boolean;
  expired: boolean;
};

export type CreditOrgBalance = {
  organizationId: string;
  organizationName: string;
  currency: string;
  totalCents: number;
  spendableCents: number;
  pendingCents: number;
  paidCents: number;
  nearestExpiryAt: string | null;
  nearestActivationAt: string | null;
  acceptsMoreCredits: boolean;
  lots: CreditLot[];
};

export type ListCreditBalancesResult = {
  organizations: CreditOrgBalance[];
  nextCursor: string | null;
  /** The clock every pending/expired split in this response was computed against — anchor countdowns to this, never to the guest's own device time. */
  serverNowMs: number;
};

export async function apiListCreditBalances(
  client: SupabaseClient,
  args: { cursor?: string | null; limit?: number } = {},
): Promise<ListCreditBalancesResult> {
  const res = await invokeEF<ListCreditBalancesResult>(
    client,
    "consumer-web-list-credit-balances",
    { cursor: args.cursor ?? undefined, limit: args.limit },
    "Couldn't load your Credits.",
  );
  return {
    organizations: res.organizations ?? [],
    nextCursor: res.nextCursor ?? null,
    serverNowMs: res.serverNowMs,
  };
}
