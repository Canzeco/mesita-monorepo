// moneyState (MESITA-3302). ONE source, TWO copies: this file and
// packages/place-profile/src/money-state.ts are byte-identical; `deno task
// sync-shared` copies, money-twins.test.ts and `sync-shared:check` refuse
// drift. It imports nothing, so it compiles under Deno and under the
// package's TypeScript alike.
//
// MoneySettings are the owner's switches; MoneyState is what they mean for a
// guest now, given the account and the guest's balance. It gates selling,
// never settling: credit lands whenever Stripe says a session is paid,
// whatever the switches read by then.
//
// Credit is the place's debt (MESITA-3408): no switch stops a guest spending
// it. `pay` is credit or both whenever spendable > 0.
//
// `mesita_pay` is the green mark (the key keeps its old name: renaming a key
// breaks readers; the products are Mesita Payments and Mesita Prepayments,
// MESITA-3597): on when a guest can pay the bill by card here now (Mesita
// Payments, W2b, CARD_BILL_PAY_LIVE) or buy a voucher (Mesita Prepayments):
//   mesita_pay = (CARD_BILL_PAY_LIVE && cards) || sell.length > 0
// Three blind spots on purpose, because the list rows cannot see them: the
// admin pause, Welcome-used and the fee hold (MESITA-3461) do not turn the
// mark off.
// CARD_BILL_PAY_LIVE is code, not config, on purpose: one edit turns card bill
// pay off the mark and brings back the "arrives soon" notes on Business ›
// Payments, should W2b ever be pulled.

/** Card payment of the bill (W2b, MESITA-3305) is live: flipped by
 *  MESITA-3408 once W2b had merged. */
export const CARD_BILL_PAY_LIVE = true;

export const MONEY_VOUCHER_KEYS = [
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_welcome",
  "voucher_story",
  "voucher_vip",
] as const;
export type MoneyVoucherKey = (typeof MONEY_VOUCHER_KEYS)[number];

/** The owner's switches, the Place states of Main §10 (MESITA-3589).
 *  `pay_cards` is Mesita Payments (MESITA-3396, the key is never renamed:
 *  renaming resets live config); absent reads ON, so a reader from before it
 *  keeps working. `house_credits` is House Credits (On only while a signed
 *  House Credits Contract exists, enforced in SQL). `cash_payments` is Cash
 *  Payments (the waiter confirms a bill paid outside). The two rates are the
 *  place's own cashback in bps, null/absent = Off. `has_place_code` is not a
 *  switch but a fact the caller passes when it read place_codes
 *  (MESITA-3545): the waiter's Received needs one. Absent reads false.
 *  `prepayments` is Mesita Prepayments (MESITA-3597): a voucher sells only
 *  when it AND the voucher's own switch are on; absent reads ON, so a reader
 *  from before it keeps working. The six voucher switches are Mesita
 *  Prepayments' sub-settings. */
export type MoneySettings = {
  pay_cards?: boolean;
  prepayments?: boolean;
  house_credits?: boolean;
  cash_payments?: boolean;
  card_cashback_bps?: number | null;
  cash_cashback_bps?: number | null;
  has_place_code?: boolean;
} & Record<MoneyVoucherKey, boolean>;

/** The place's connected account as the ledger last saw it; null = none.
 *  `fee_hold` (MESITA-3461): Mesita's fee invoice is unpaid, so cards are
 *  off until it is paid; absent reads no hold. */
export type MoneyAccount = { charges_enabled: boolean; fee_hold?: boolean } | null;

/** The guest's balance at the place; null = no account or nothing there. */
export type MoneyBalance = { spendable_cents: number } | null;

/** Why a voucher is not for sale right now. */
export type VoucherReason =
  | "off"
  | "needs_account"
  /** House Credits is Off here (MESITA-3589): no new credits, so no voucher. */
  | "needs_house_credits"
  /** Mesita's fee invoice is unpaid (MESITA-3461): Billing is Past due. */
  | "needs_billing"
  | "not_yet"
  | "needs_card_payments"
  | "needs_instagram"
  /** Selling is paused for every place (the admin console's kill switch). */
  | "paused"
  /** Welcome: this guest already had theirs here, or has paid here before. */
  | "used"
  /** Story and VIP, one each new visit (MESITA-3463): this guest already
   *  bought one here for every visit (a paid bill with a card part). */
  | "needs_visit";

/** Vouchers in the catalog that no wave sells yet, and why. Empty since
 *  MESITA-3550: every voucher sells where its owner switches it on (the
 *  owner's switch is the owner's yes; the admin pause still stops all).
 *  Story's and VIP's gates are the guest's own, checked by the buy EF:
 *  Story a linked Instagram above STORY_MIN_FOLLOWERS (MESITA-3507), VIP the
 *  VIP class (MESITA-3550), and both sell one each new visit (MESITA-3463).
 *  Kept so a later voucher can wait for its wave with one line. */
export const NOT_YET_SELLABLE: Partial<Record<MoneyVoucherKey, VoucherReason>> = {};

/** Story is for guests whose linked Instagram has MORE than this many
 *  followers (MESITA-3507, Pato: "only available for users that have more
 *  than 1000 followers in instagram"). The buy EF refuses the rest. */
export const STORY_MIN_FOLLOWERS = 1000;

export type PayWay = "credit" | "card" | "both" | "none";

export type MoneyState = {
  /** The vouchers a guest can buy here now. */
  sell: MoneyVoucherKey[];
  /** Every voucher not in `sell`, with its reason. */
  unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>>;
  /** Cashback lands on the card part of a payment here (Mesita Payments
   *  Cashback): `card_cashback_bps` > 0. */
  cashback: boolean;
  /** What the card part of the bill earns here now, in bps; 0 = none
   *  (MESITA-3589: the place's own rate, needs House Credits and cards). */
  card_cashback_bps: number;
  /** A bill paid outside can be confirmed here by the waiter's Received
   *  (Cash Payments On and a place code), with or without cashback. */
  cash: boolean;
  /** Cashback lands on a bill paid outside and confirmed by the waiter's
   *  Received (Cash Payments Cashback): `cash_cashback_bps` > 0. */
  outside_cashback: boolean;
  /** What the cash part of the bill earns here now, in bps; 0 = none
   *  (needs House Credits, Cash Payments and a place code). */
  cash_cashback_bps: number;
  /** House Credits is On here: new credit can be born (cashback, vouchers).
   *  Off never stops a guest spending credit they already hold. */
  house_credits: boolean;
  /** How a guest can pay here: from credit, by card, both, or not at all. */
  pay: PayWay;
  /** The green mark: Mesita Payments or Mesita Prepayments here now (see the header). */
  mesita_pay: boolean;
};

export function moneyState(settings: MoneySettings, account: MoneyAccount, balance: MoneyBalance): MoneyState {
  const charges = account?.charges_enabled === true;
  const billingDue = account?.fee_hold === true;
  // Mesita Payments (MESITA-3396) needs the account too. Absent means on.
  // An unpaid fee invoice (MESITA-3461) holds cards off without touching it.
  const cards = charges && !billingDue && settings.pay_cards !== false;
  const houseCredits = settings.house_credits === true;
  const cash = settings.cash_payments === true && settings.has_place_code === true;
  // Mesita Prepayments (MESITA-3597). Absent means on, as pay_cards.
  const prepayments = settings.prepayments !== false;
  const sell: MoneyVoucherKey[] = [];
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = {};
  for (const key of MONEY_VOUCHER_KEYS) {
    if (settings[key] !== true || !prepayments) unavailable[key] = "off";
    else if (!houseCredits) unavailable[key] = "needs_house_credits";
    else if (!charges) unavailable[key] = "needs_account";
    else if (billingDue) unavailable[key] = "needs_billing";
    else if (NOT_YET_SELLABLE[key]) unavailable[key] = NOT_YET_SELLABLE[key];
    else sell.push(key);
  }
  const credit = (balance?.spendable_cents ?? 0) > 0;
  const pay: PayWay = credit && cards ? "both" : credit ? "credit" : cards ? "card" : "none";
  const rate = (v: number | null | undefined) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : 0);
  // Cashback is new credit: it needs House Credits, and lands on the card
  // part (cards on) or the cash bill part (Cash Payments on), never the tip.
  const card_cashback_bps = houseCredits && cards ? rate(settings.card_cashback_bps) : 0;
  const cash_cashback_bps = houseCredits && cash ? rate(settings.cash_cashback_bps) : 0;
  const mesita_pay = (CARD_BILL_PAY_LIVE && cards) || sell.length > 0;
  return {
    sell,
    unavailable,
    cashback: card_cashback_bps > 0,
    card_cashback_bps,
    cash,
    outside_cashback: cash_cashback_bps > 0,
    cash_cashback_bps,
    house_credits: houseCredits,
    pay,
    mesita_pay,
  };
}
