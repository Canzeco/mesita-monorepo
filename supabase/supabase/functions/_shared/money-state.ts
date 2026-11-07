// moneyState (MESITA-3302). ONE source, TWO copies: this file and
// packages/place-profile/src/money-state.ts are byte-identical; `deno task
// sync-shared` copies, money-twins.test.ts and `sync-shared:check` refuse
// drift. It imports nothing, so it compiles under Deno and under the
// package's TypeScript alike.
//
// What a place sells, whether cashback applies and how a guest can pay,
// from the owner's switches, the account's state and the guest's balance.
// It gates selling, never settling: credit lands whenever Stripe says a
// session is paid, whatever the switches read by then.

export const MONEY_VOUCHER_KEYS = [
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_welcome",
  "voucher_story",
  "voucher_vip",
] as const;
export type MoneyVoucherKey = (typeof MONEY_VOUCHER_KEYS)[number];

export type MoneySettings = { cashback: boolean } & Record<MoneyVoucherKey, boolean>;

/** The place's connected account as the ledger last saw it; null = none. */
export type MoneyAccount = { charges_enabled: boolean } | null;

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
  | "used";

/** Vouchers in the catalog that no wave sells yet, and why. W1b sells the
 *  other three; MX$5,000 waits for its own wave, VIP for card payments
 *  (W2b) and Story for the Instagram bot (W4). */
export const NOT_YET_SELLABLE: Partial<Record<MoneyVoucherKey, VoucherReason>> = {
  voucher_5000: "not_yet",
  voucher_vip: "needs_card_payments",
  voucher_story: "needs_instagram",
};

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
};

export function moneyState(settings: MoneySettings, account: MoneyAccount, balance: MoneyBalance): MoneyState {
  const charges = account?.charges_enabled === true;
  const sell: MoneyVoucherKey[] = [];
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = {};
  for (const key of MONEY_VOUCHER_KEYS) {
    if (settings[key] !== true) unavailable[key] = "off";
    else if (!charges) unavailable[key] = "needs_account";
    else if (NOT_YET_SELLABLE[key]) unavailable[key] = NOT_YET_SELLABLE[key];
    else sell.push(key);
  }
  const hasBalance = (balance?.spendable_cents ?? 0) > 0;
  const pay: PayWay = hasBalance && charges ? "both" : hasBalance ? "credit" : charges ? "card" : "none";
  return { sell, unavailable, cashback: settings.cashback === true && charges, pay };
}
