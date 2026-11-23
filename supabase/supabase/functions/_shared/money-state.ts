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
// admin pause, the guest's own limits and the fee hold (MESITA-3461) do not turn the
// mark off.
// CARD_BILL_PAY_LIVE is code, not config, on purpose: one edit turns card bill
// pay off the mark and brings back the "arrives soon" notes on Business ›
// Payments, should W2b ever be pulled.

/** Card payment of the bill (W2b, MESITA-3305). OFF since MESITA-4698 (Pato,
 *  2026-11-22: "exclude for the moment payments in the card ... only vouchers
 *  are sold in advance with Mesita"): a bill is paid with credit and the rest
 *  outside (cash or the place's own terminal). Card, Apple Pay and Google Pay
 *  still buy vouchers. Every card-for-a-bill door asks this through
 *  cardRefusal (pay-card.ts) and cardsAccepted (payments.ts). */
export const CARD_BILL_PAY_LIVE = false;

export const MONEY_VOUCHER_KEYS = [
  // WELCOME IS BACK (Pato, 2026-11-22, MESITA-4645: "RETURN THE WELCOME
  // BONUS. WELCOME AND THEN THE OTHER BONUSES."): once per guest per place.
  "voucher_welcome",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  // VIP IS BACK (Pato, 2026-11-22, MESITA-4640: "Regular Offers · VIP Offers"):
  // the VIP class only (guest_class, more than VIP_MIN_FOLLOWERS on a verified
  // Instagram; privacy no longer counts, MESITA-4659), one each new visit.
  "voucher_vip",
] as const;
export type MoneyVoucherKey = (typeof MONEY_VOUCHER_KEYS)[number];

/** The owner's switches, the Place states of Main §10 (MESITA-3589).
 *  `pay_cards` is Mesita Payments (MESITA-3396, the key is never renamed:
 *  renaming resets live config); absent reads ON, so a reader from before it
 *  keeps working. `loyalty_cards` is Loyalty Cards (On only while a signed
 *  Loyalty Cards Agreement exists, enforced in SQL). `cash_payments` is Cash
 *  Payments (the waiter confirms a bill paid outside). `has_place_code` is not a
 *  switch. A click signs (MESITA-4485), so Cash Payments does not wait on it.
 *  `prepayments` is Mesita Prepayments (MESITA-3597): a voucher sells only
 *  when it AND the voucher's own switch are on; absent reads ON, so a reader
 *  from before it keeps working. The six voucher switches are Mesita
 *  Prepayments' sub-settings. */
export type MoneySettings = {
  /** MESITA-3946: Accept Stripe Payments; Off stops cards and vouchers. Absent reads ON. */
  stripe_payments?: boolean;
  pay_cards?: boolean;
  prepayments?: boolean;
  loyalty_cards?: boolean;
  cash_payments?: boolean;
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
  /** Loyalty Cards is Off here (MESITA-3589): no new credits, so no voucher. */
  | "needs_loyalty_cards"
  /** Mesita's fee invoice is unpaid (MESITA-3461): Billing is Past due. */
  | "needs_billing"
  | "not_yet"
  | "needs_card_payments"
  | "needs_instagram"
  /** Selling is paused for every place (the admin console's kill switch). */
  | "paused"
  /** Welcome: this guest already had theirs here, or has paid here before. */
  | "used"
  /** The VIP voucher is for the VIP class (MESITA-4640). */
  | "not_vip"
  /** VIP, one each new visit (MESITA-3463): this guest already
   *  bought one here for every visit (a paid bill with a card part). */
  | "needs_visit";

/** Vouchers in the catalog that are not on sale, and why. Business ›
 *  Payments and the guest's Offers page list neither (both filter on this
 *  record), and the buy EF refuses both, whatever the owner's stored switch
 *  says. STORY IS PARKED (Pato, 2026-11-13, MESITA-3831: "remove story and
 *  vip for the moment"; VIP came back the same night, MESITA-3833). THE
 *  MX$5,000 VOUCHER IS RETIRED (Pato, MESITA-3834: "Lets remove the medium
 *  shit just like this ... KEEP IT LIKE THIS": four vouchers, Welcome · Small
 *  · Big · VIP, Big being the MX$1,000 one). Nothing else is removed: the
 *  switches, the catalog lines and Story's gates stay, and vouchers already
 *  bought keep working. Deleting a line brings that voucher back. MEDIUM IS
 *  BACK (Pato, 2026-11-15, MESITA-4056). Since MESITA-4152 Medium is
 *  voucher_1000 (MX$1,000 +20%) and Big voucher_5000 (MX$5,000 +30%).
 *  VIP IS PARKED AND STORY IS BACK (Pato, 2026-11-16, MESITA-4197: "Should
 *  we really have VIP or only Story???" ... "hide VIP for the moment"): the
 *  one-time offers are Welcome and Story. */
//  THE VIP OFFER IS GONE (Pato, 2026-11-17, MESITA-4249: "THE VIP OFFER IS
//  GONE ACROSS ALL THE APP"): the special offers are Welcome and Story. Its
//  key left the catalog; place_payment_settings.voucher_vip is a dead column.
//  THE WELCOME VOUCHER IS GONE TOO (Pato, 2026-11-21, MESITA-4636: "i don't
//  want fucking fradus"). Its key left the catalog;
//  place_payment_settings.voucher_welcome is a dead column, false
//  everywhere. Welcome purchases already paid stay in the ledger.
//  WELCOME IS BACK (Pato, 2026-11-22, MESITA-4645: "RETURN THE WELCOME
//  BONUS"): its key is in the catalog again and the column is a live switch.
//  STORIES ARE GONE (Pato, 2026-11-22, MESITA-4641/4642: "REMOVE STORIES FROM
//  EVERYWHERE"): voucher_story left the catalog the same way; its purchases
//  stay readable (the voucher is stored as text) and a buy is refused with
//  voucher_retired (vouchers.ts RETIRED_VOUCHERS).
//  WELCOME AND VIP ARE CASHBACK LINES NOW (Pato, 2026-11-22, MESITA-4698):
//  vouchers are Small · Medium · Big only, the bonus by amount alone. The two
//  keys stay in the catalog so old purchases read; every list hides them and
//  the buy door refuses them (vouchers.ts RETIRED_VOUCHERS).
export const NOT_YET_SELLABLE: Partial<Record<MoneyVoucherKey, VoucherReason>> = {
  voucher_welcome: "off",
  voucher_vip: "off",
};

/** VIP CLASS (MESITA-4639, Pato 2026-11-22: "RETURN VIP CLASS IF MORE THAN
 *  5000 FOLLOWERS"): a verified Instagram with MORE THAN this many
 *  followers. consumers.guest_class holds the same literal (a generated column
 *  cannot read config); vip-threshold.test.ts pins the two together. Every
 *  word a guest or owner reads about the bar comes from this constant. */
export const VIP_MIN_FOLLOWERS = 5000;

export type PayWay = "credit" | "card" | "both" | "none";

export type MoneyState = {
  /** The vouchers a guest can buy here now. */
  sell: MoneyVoucherKey[];
  /** Every voucher not in `sell`, with its reason. */
  unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>>;
  /** A bill paid outside can be confirmed here by the waiter's Received
   *  (Cash Payments On and a place code). */
  cash: boolean;
  /** Loyalty Cards is On here: new credit can be born (vouchers).
   *  Off never stops a guest spending credit they already hold. */
  loyalty_cards: boolean;
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
  // Accept Stripe Payments (MESITA-3946) is over both card products.
  const stripe = settings.stripe_payments !== false;
  const cards = charges && !billingDue && stripe && settings.pay_cards !== false;
  const loyaltyCards = settings.loyalty_cards === true;
  const cash = settings.cash_payments === true;
  // Mesita Prepayments (MESITA-3597). Absent means on, as pay_cards.
  const prepayments = stripe && settings.prepayments !== false;
  const sell: MoneyVoucherKey[] = [];
  const unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>> = {};
  for (const key of MONEY_VOUCHER_KEYS) {
    if (settings[key] !== true || !prepayments) unavailable[key] = "off";
    else if (!loyaltyCards) unavailable[key] = "needs_loyalty_cards";
    else if (!charges) unavailable[key] = "needs_account";
    else if (billingDue) unavailable[key] = "needs_billing";
    else if (NOT_YET_SELLABLE[key]) unavailable[key] = NOT_YET_SELLABLE[key];
    else sell.push(key);
  }
  const credit = (balance?.spendable_cents ?? 0) > 0;
  const pay: PayWay = credit && cards ? "both" : credit ? "credit" : cards ? "card" : "none";
  const mesita_pay = (CARD_BILL_PAY_LIVE && cards) || sell.length > 0;
  return {
    sell,
    unavailable,
    cash,
    loyalty_cards: loyaltyCards,
    pay,
    mesita_pay,
  };
}
