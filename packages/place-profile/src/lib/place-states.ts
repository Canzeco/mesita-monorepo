// Place States (Pato, 2026-11-09, MESITA-3588; the list is Main §10,
// MESITA-3586): what the BUSINESS decides, beside Profile States (what comes
// from Google or Mesita). ONE calculation, read by Business › Admin's Place
// States card and by the admin console's Manage Multiple and Manage Single
// tables (MESITA-3595), so the two apps can never disagree.
//
// The money states read moneyState, the same helper Business › Payments and
// the guest's place screen read. Inputs are structural: Business passes its
// Payments read for one place, the admin console the same facts its place
// list ships per row.

import { moneyState, type MoneySettings } from "../money-state";

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

export const STRIPE_STATES: readonly StripeState[] = [
  "None",
  "Onboarding",
  "In review",
  "Connected",
  "Action needed",
  "Payouts paused",
  "Restricted",
];

export type StripeStageKey =
  | "none"
  | "onboarding"
  | "in_review"
  | "connected"
  | "action_needed"
  | "payouts_paused"
  | "restricted";

const STAGE: Record<StripeStageKey, StripeState> = {
  none: "None",
  onboarding: "Onboarding",
  in_review: "In review",
  connected: "Connected",
  action_needed: "Action needed",
  payouts_paused: "Payouts paused",
  restricted: "Restricted",
};

/** The account as the server's accountView shapes it. */
export type PlaceStatesAccount = {
  state: "none" | "onboarding" | "ready" | "restricted";
  stage?: StripeStageKey;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: number;
};

export function stripeState(a: PlaceStatesAccount | null): StripeState {
  if (a?.stage) return STAGE[a.stage];
  if (!a || a.state === "none") return "None";
  if (a.state === "restricted") return "Restricted";
  if (!a.details_submitted) return "Onboarding";
  if (!a.charges_enabled) return "In review";
  if (!a.payouts_enabled) return "Payouts paused";
  if (a.requirements_due > 0) return "Action needed";
  return "Connected";
}

/** The owner's switches as settingsFromRow shapes them, without the place
 *  code (the caller passes that as `codeSet`). */
export type PlaceStatesSettings = Omit<MoneySettings, "has_place_code">;

export type PlaceStatesInput = {
  account: PlaceStatesAccount | null;
  settings: PlaceStatesSettings | null;
  contract: { signed: boolean } | null;
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
  houseCreditsContract: PlaceStateValue;
  houseCredits: PlaceStateValue;
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
    houseCreditsContract: i.contract
      ? { on: i.contract.signed, chip: i.contract.signed ? "Signed" : "Not signed" }
      : { on: false, chip: "?" },
    houseCredits: onOff(s?.house_credits === true),
    // Cash Payments: the owner's switch and the waiter's code (MESITA-3589).
    cashPayments: onOff(money?.cash === true),
    cashPaymentsCashback: money && money.cash_cashback_bps > 0
      ? { on: true, chip: `${money.cash_cashback_bps / 100}%` }
      : { on: false, chip: "Off" },
    // Mesita Payments: a guest can pay the bill by card in the app now
    // (the Mesita Pay switch, the account taking cards, no fee hold).
    mesitaPayments: onOff(money?.pay === "card"),
    mesitaPaymentsCashback: money && money.card_cashback_bps > 0
      ? { on: true, chip: `${money.card_cashback_bps / 100}%` }
      : { on: false, chip: "Off" },
    mesitaPrepayments: onOff((money?.sell.length ?? 0) > 0),
  };
}

/** Plan (MESITA-3174): Free · Pro · Max, the subscription the place pays.
 *  Rank 1 = Pro (Premier 2X), 2 = Max (Premier 5X); 0 or none is Free. */
export const FREE_PLAN = "Free";
const PLAN_BY_RANK: Record<number, string> = { 1: "Pro", 2: "Max" };

export function planName(rank: number | null | undefined): string {
  return (rank && PLAN_BY_RANK[rank]) || FREE_PLAN;
}

/** Owned (Main §10): three values. `owned` = a live owner seat (MESITA-3158:
 *  claimed and verified); `pending` = no owner yet, but someone asked to
 *  claim it and Mesita has not decided (a pending verification request,
 *  MESITA-3127); `unclaimed` = neither. */
export type OwnedState = "owned" | "pending" | "unclaimed";

const OWNED_CHIP: Record<OwnedState, string> = {
  owned: "Owned",
  pending: "Claim pending",
  unclaimed: "Unclaimed",
};

/** An owner wins over a pending request. */
export function ownedState(hasOwner: boolean, hasPendingClaim: boolean): OwnedState {
  return hasOwner ? "owned" : hasPendingClaim ? "pending" : "unclaimed";
}

export function ownedChip(owned: OwnedState): PlaceStateValue {
  return { on: owned === "owned", chip: OWNED_CHIP[owned] };
}

/** The Place States rows of Main §10, in the order both apps print them. */
export const PLACE_STATE_ROWS = [
  { key: "owned", label: "Owned" },
  { key: "plan", label: "Plan" },
  { key: "billing", label: "Billing" },
  { key: "stripe", label: "Stripe" },
  { key: "reservations", label: "Reservations" },
  { key: "houseCreditsContract", label: "House Credits Contract" },
  { key: "houseCredits", label: "House Credits" },
  { key: "cashPayments", label: "Cash Payments" },
  { key: "cashPaymentsCashback", label: "Cash Payments Cashback" },
  { key: "mesitaPayments", label: "Mesita Payments" },
  { key: "mesitaPaymentsCashback", label: "Mesita Payments Cashback" },
  { key: "mesitaPrepayments", label: "Mesita Prepayments" },
] as const;

export type PlaceStateKey = (typeof PLACE_STATE_ROWS)[number]["key"];
