// Frontend API surface for the REAL Buy + Gift Credits paths
// (MESITA-1676, MESITA-1677).
//
// Balances still run on the browser emulator (src/lib/mock/*, MESITA-1674).
// Buy, Gift, Redeem and the sent-gifts list are real. Every helper here
// resolves money terms server-side — nothing in this file computes a bonus
// or an expiry that will actually be charged; the numbers in each response
// are for DISPLAY, echoed back from what the server already decided and
// wrote.

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

// ─── Gift (MESITA-1677) — issuance only, never a transfer ──────────────────

export type GiftCreditsOutcome =
  | {
    state: "purchased";
    giftId?: string;
    /** Shown to the sender exactly once — this response is the only place
     *  it is ever available in plaintext. See consumer-web-gift-credits'
     *  own header for why a dropped response means the code is gone
     *  (cancel the gift to get the lot back; nothing is lost but the code). */
    code: string;
    mock?: boolean;
    expiresAt: string;
    expiryDays: number;
    bonusCents: number;
  }
  | {
    state: "requires_action";
    requiresAction: TicketPaymentAction;
  };

/** Same `requestId` retry-safety contract as `apiBuyCredits`. */
export async function apiGiftCredits(
  client: SupabaseClient,
  args: { placeId: string; paidCents: number; note: string | null; requestId: string },
): Promise<GiftCreditsOutcome> {
  return invokeEF<GiftCreditsOutcome>(
    client,
    "consumer-web-gift-credits",
    args,
    "Couldn't send that gift.",
  );
}

export type RedeemGiftOutcome = {
  lotId: string;
  organizationId?: string;
  organizationName: string;
  paidCents?: number;
  bonusCents?: number;
  creditedCents: number;
  note: string | null;
  expiresAt?: string;
};

export async function apiRedeemGift(
  client: SupabaseClient,
  code: string,
): Promise<RedeemGiftOutcome> {
  return invokeEF<RedeemGiftOutcome>(
    client,
    "consumer-web-redeem-credit-gift",
    { code },
    "That code didn't work.",
  );
}

export async function apiCancelGift(
  client: SupabaseClient,
  giftId: string,
): Promise<{ lotId: string }> {
  return invokeEF<{ lotId: string }>(
    client,
    "consumer-web-cancel-credit-gift",
    { giftId },
    "Couldn't cancel that gift.",
  );
}

export type SentGift = {
  id: string;
  organizationName: string;
  paidCents: number;
  bonusCents: number;
  creditedCents: number;
  state: "unclaimed" | "claimed" | "cancelled";
  note: string | null;
  createdAt: string;
  claimedAt: string | null;
  cancelledAt: string | null;
  /** The CLAIM deadline — a still-"unclaimed" row past this is effectively
   *  dead even though the DB never stamps a fourth state (credit_gifts'
   *  own design: "expired" is derived at read time, not a persisted row). */
  expiresAt: string;
};

export async function apiListSentGifts(client: SupabaseClient): Promise<SentGift[]> {
  const res = await invokeEF<{ gifts: SentGift[] }>(
    client,
    "consumer-web-list-credit-gifts",
    {},
    "Couldn't load your sent gifts.",
  );
  return res.gifts ?? [];
}
