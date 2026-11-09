// Place States (Pato, 2026-11-09, MESITA-3588; the list is Main §10,
// MESITA-3586): what the BUSINESS decides, beside Profile States (what comes
// from Google or Mesita). Read-only; each state is drawn from data that
// already exists. Three of Main's states have no data yet and are left off
// rather than faked (Pato rejects mock data): House Credits Contract, House
// Credits as its own switch (today the Cashback switch stands in), and
// cashback as a number the place sets (today fixed 5% / 2%).
//
// The money states read moneyState, the same helper Business › Payments and
// the guest's place screen read, so the three can never disagree.

import { moneyState } from "@mesita/place-profile";
import { CARD_CASHBACK_PCT, OUTSIDE_CASHBACK_PCT } from "@mesita/place-profile/lib/mesita-row";
import type { PaymentAccount, PaymentSettings } from "@/lib/business-api";

/** Place Stripe (Main §10): seven values, all from the account Stripe last
 *  reported. Mesita Payments and Prepayments work in Connected, Action needed
 *  and Payouts paused. */
export type StripeState =
  | "None"
  | "Onboarding"
  | "In review"
  | "Connected"
  | "Action needed"
  | "Payouts paused"
  | "Restricted";

export function stripeState(a: PaymentAccount | null): StripeState {
  if (!a || a.state === "none") return "None";
  if (a.state === "restricted") return "Restricted";
  if (!a.details_submitted) return "Onboarding";
  if (!a.charges_enabled) return "In review";
  if (!a.payouts_enabled) return "Payouts paused";
  if (a.requirements_due > 0) return "Action needed";
  return "Connected";
}

export type PlaceStatesInput = {
  account: PaymentAccount | null;
  settings: PaymentSettings | null;
  codeSet: boolean;
  /** Mesita's fee invoice unpaid (MESITA-3461): cards are off until paid. */
  feeHold: boolean;
  feeOverdue: boolean;
  reservations: boolean | null;
};

/** One row's value: `on` lights the chip, `chip` is what it reads. */
export type PlaceStateValue = { on: boolean; chip: string };

export type MoneyPlaceStates = {
  billing: PlaceStateValue;
  stripe: PlaceStateValue;
  reservations: PlaceStateValue;
  cashPayments: PlaceStateValue;
  cashPaymentsCashback: PlaceStateValue;
  mesitaPayments: PlaceStateValue;
  mesitaPaymentsCashback: PlaceStateValue;
  mesitaPrepayments: PlaceStateValue;
};

const onOff = (on: boolean): PlaceStateValue => ({ on, chip: on ? "On" : "Off" });

export function moneyPlaceStates(i: PlaceStatesInput): MoneyPlaceStates {
  const s = i.settings;
  const money = s
    ? moneyState(
        { ...s, has_place_code: i.codeSet },
        i.account ? { charges_enabled: i.account.charges_enabled, fee_hold: i.feeHold } : null,
        null,
      )
    : null;
  const stripe = stripeState(i.account);
  const pastDue = i.feeHold || i.feeOverdue;
  return {
    billing: { on: !pastDue, chip: pastDue ? "Past due" : "Paid up" },
    stripe: { on: stripe === "Connected", chip: stripe },
    reservations: i.reservations == null ? { on: false, chip: "?" } : onOff(i.reservations),
    // Cash Payments: the waiter's code is set, so staff can confirm a bill
    // paid outside Mesita (MESITA-3545). Turning it on includes the code.
    cashPayments: onOff(i.codeSet),
    cashPaymentsCashback: money?.outside_cashback
      ? { on: true, chip: `${OUTSIDE_CASHBACK_PCT}%` }
      : { on: false, chip: "Off" },
    // Mesita Payments: a guest can pay the bill by card in the app now
    // (the Mesita Pay switch, the account taking cards, no fee hold).
    mesitaPayments: onOff(money?.pay === "card"),
    mesitaPaymentsCashback: money?.cashback
      ? { on: true, chip: `${CARD_CASHBACK_PCT}%` }
      : { on: false, chip: "Off" },
    mesitaPrepayments: onOff((money?.sell.length ?? 0) > 0),
  };
}
