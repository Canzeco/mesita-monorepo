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
// `mesita_pay` is the green Mesita Pay mark: on when a guest can do something
// on Mesita Pay here now: pay the bill by card (W2b, CARD_BILL_PAY_LIVE) or
// buy a voucher:
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

/** The owner's switches. `pay_cards` is the Mesita Pay switch (MESITA-3396, the key is
 *  never renamed: renaming resets live config); absent reads ON, so a reader
 *  from before it keeps working. */
export type MoneySettings = { cashback: boolean; pay_cards?: boolean } & Record<MoneyVoucherKey, boolean>;

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
  /** Cashback lands on the card part of a payment here. */
  cashback: boolean;
  /** How a guest can pay here: from credit, by card, both, or not at all. */
  pay: PayWay;
  /** The green Mesita Pay mark (see the header). */
  mesita_pay: boolean;
};

export function moneyState(settings: MoneySettings, account: MoneyAccount, balance: MoneyBalance): MoneyState {
  const charges = account?.charges_enabled === true;
  // the Mesita Pay switch (MESITA-3396) needs the account too. Absent means on.
  // An unpaid fee invoice (MESITA-3461) holds cards off without touching it.
  const cards = charges && account?.fee_hold !== true && settings.pay_cards !== false;
  const sell: MoneyVoucherKey[] = [];
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = {};
  for (const key of MONEY_VOUCHER_KEYS) {
    if (settings[key] !== true) unavailable[key] = "off";
    else if (!charges) unavailable[key] = "needs_account";
    else if (NOT_YET_SELLABLE[key]) unavailable[key] = NOT_YET_SELLABLE[key];
    else sell.push(key);
  }
  const credit = (balance?.spendable_cents ?? 0) > 0;
  const pay: PayWay = credit && cards ? "both" : credit ? "credit" : cards ? "card" : "none";
  // Cashback lands on the card part, so it needs Cards on, not just the account.
  const mesita_pay = (CARD_BILL_PAY_LIVE && cards) || sell.length > 0;
  return { sell, unavailable, cashback: settings.cashback === true && cards, pay, mesita_pay };
}
