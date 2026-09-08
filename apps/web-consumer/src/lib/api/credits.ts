// Frontend API surface for the REAL Buy Credits path (MESITA-1676).
//
// The rest of the Wallet's Credits surface — balances, Gift, Redeem — still
// runs on the browser emulator (src/lib/mock/*); this file is the first real
// wire, and only for buying. consumer-web-buy-credits resolves every money
// term server-side, so nothing here computes a bonus or an expiry that will
// actually be charged — bonusCents/activatesAt/expiresAt in the response are
// for DISPLAY, echoed back from what the server already decided and wrote.

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
