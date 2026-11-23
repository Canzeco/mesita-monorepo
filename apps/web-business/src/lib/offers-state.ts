// What Offers reads as "on" (MESITA-4732), in one place: the Offers page and
// Monitor's off states both import these, so a Monitor page says "off"
// exactly when Offers does.

import type { PaymentSettings, PlacePayments } from "@/lib/business-api";

/** The vouchers Offers lists: Small, Medium, Big. Welcome and VIP are not on Offers. */
export const OFFERED_VOUCHER_KEYS = ["voucher_200", "voucher_1000", "voucher_5000"] as const;

/** The Stripe Account takes cards in the server's mode (MESITA-3599). */
export function stripeTakesCards(p: Pick<PlacePayments, "account" | "test_mode">): boolean {
  return p.account.charges_enabled && p.account.livemode === !p.test_mode;
}

/** Accept Prepayments reads On: both keys on and the Stripe Account takes cards. */
export function prepaymentsOn(settings: PaymentSettings, takesCards: boolean): boolean {
  return Boolean(settings.prepayments && settings.stripe_payments && takesCards);
}

/** Guests can buy a voucher now: Accept Prepayments on, no fee hold, one voucher on. */
export function vouchersLive(p: PlacePayments): boolean {
  const s = p.settings;
  return prepaymentsOn(s, stripeTakesCards(p)) && !p.fee.hold && OFFERED_VOUCHER_KEYS.some((k) => Boolean(s[k]));
}
