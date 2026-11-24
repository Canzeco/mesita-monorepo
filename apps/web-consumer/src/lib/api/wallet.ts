// Wallet — the guest's credit at each place (MESITA-3097/3098; on the
// place's own Stripe Connect account since MESITA-3302; vouchers bought
// here since MESITA-3303). Every amount and outcome comes from the server:
// this file never computes money, it only formats it. (The one display-only
// sum is lib/wallet-entries.ts: a voucher and its bonus, written by the
// server in one transaction, read as one row, MESITA-3750.)

import type { SupabaseClient } from "@supabase/supabase-js";
import { placeMoneyFrom, type PlaceMoney, type VoucherKey } from "@mesita/place-profile";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { invokeEF } from "./_invoke";
import type { PayMethod, SavedCard } from "./cards";

/** The screen cache's key for the Wallet read (lib/screen-cache.ts): Me ›
 *  Tickets, a credit movement's page and the Loyalty Card share one answer, so
 *  a row tapped on any of them opens on what that screen just read
 *  (MESITA-3753). */
export const WALLET_CACHE_KEY = "activity-wallet";

export type WalletEntry = {
  kind: string;
  amount_cents: number;
  at: string;
  pending: boolean;
  /** When a pending entry turns Available (MESITA-3549); null otherwise.
   *  Absent from a server before MESITA-3549. */
  available_at?: string | null;
  /** A spend's payment (MESITA-3304): the Wallet links it to its proof. */
  payment_id?: string | null;
  /** The purchase behind a voucher, prepay, bonus or purchase reversal
   *  (MESITA-3750); null on payment and gift rows; absent from a server
   *  before MESITA-3750. */
  purchase_id?: string | null;
  /** The gift behind a gift_out, gift_in or gift_back (MESITA-4066): the
   *  entry page forwards to that gift's page. Absent before MESITA-4066. */
  gift_id?: string | null;
  /** Which line paid a `cashback` entry (MESITA-4766, MESITA-4789): welcome ·
   *  welcome_vip · returning · returning_vip. Absent on other kinds and older reads. */
  reason?: string | null;
};

export type WalletBalance = {
  place_id: string;
  /** Null when the place is gone from the catalog's reach; the money stays. */
  place: {
    id: string;
    slug: string | null;
    name: string | null;
    photo: string | null;
    /** Premier's stored tier, the red mark (MESITA-3514). Absent reads 0. */
    boost_tier?: number;
    /** The green Mesita Payments mark, by the list rows' rule (MESITA-3514).
     *  Absent reads as no. */
    mesita_pay?: boolean;
  } | null;
  /** Lowercase ISO 4217 ("mxn"). */
  currency: string;
  /** Everything, Available and Pending. */
  balance_cents: number;
  available_cents: number;
  pending_cents: number;
  /** What the Pay tab can spend there now: Available minus credit held by
   *  open payments, from the server (MESITA-3304). */
  spendable_cents: number;
  /** What this guest can buy here now (MESITA-4262): the vouchers Home's
   *  offer button switches through. Absent before MESITA-4262 reads as none. */
  offers?: { sell: string[] };
  last_at: string;
  entries: WalletEntry[];
  /** The guest added this card by hand (MESITA-3582). Absent reads as no. */
  pinned?: boolean;
};

/** What happened to the Checkout the guest came back from. */
export type PrepayOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none";

export type Wallet = {
  /** Stripe is in test mode: no real money moves (no band shows since MESITA-3732). */
  test_mode?: boolean;
  balances: WalletBalance[];
  /** Credit links the guest sent that nobody took yet (MESITA-3292): the
   *  amount is already off their balance; they can take it back. */
  sent_links?: SentLink[];
  /** Every gift the guest sent or received, newest first (MESITA-4036):
   *  Tickets' one Gifts list. Absent from an older server: reads as none. */
  gifts?: GiftTicket[];
  /** Sending credit is open here (MESITA-3292): always in test mode; live
   *  once the lawyer answers. Absent reads as no. */
  can_send?: boolean;
  outcome?: PrepayOutcome;
  /** The read ran out of time confirming a purchase with Stripe; it is
   *  confirmed on the next read or by the server on its own. */
  settling?: boolean;
  /** The guest's saved cards, only when asked `withCards` (MESITA-3814: the
   *  /wallet page paints once from one read). Null: Stripe failed, the money
   *  is still here. Absent when not asked. */
  cards?: SavedCard[] | null;
  /** The default way to pay (MESITA-4526), with `withCards` only. */
  pay_method?: PayMethod | null;
};

export async function apiGetWallet(
  client: SupabaseClient,
  sessionId?: string,
  opts: { withCards?: boolean } = {},
): Promise<Wallet> {
  return await invokeEF<Wallet>(client, "consumer-web-get-wallet", {
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(opts.withCards ? { with_cards: true } : {}),
  });
}

/** The place's offer and the caller's credit there (the Vouchers tab).
 *  `inWallet` (MESITA-3582): this place's Loyalty Card is already in the
 *  signed-in caller's Wallet; undefined when signed out or unknown. */
export async function apiListVouchers(
  client: SupabaseClient,
  placeId: string,
): Promise<{ money: PlaceMoney | undefined; inWallet: boolean | undefined }> {
  const r = await invokeEF<{ money: unknown; in_wallet?: unknown }>(client, "consumer-web-list-vouchers", { place_id: placeId });
  return { money: placeMoneyFrom(r.money), inWallet: typeof r.in_wallet === "boolean" ? r.in_wallet : undefined };
}

/** Pins a place's Loyalty Card to the guest's Wallet with $0 (MESITA-3582).
 *  `already`: it was pinned before. */
export async function apiAddLoyaltyCard(client: SupabaseClient, placeId: string): Promise<{ already: boolean }> {
  const r = await invokeEF<{ already?: boolean }>(client, "consumer-web-add-loyalty-card", { place_id: placeId });
  return { already: r.already === true };
}

/** Takes a pinned $0 Loyalty Card off the guest's Wallet (MESITA-3605). The
 *  server refuses with code has_credit when the guest holds anything there. */
export async function apiRemoveLoyaltyCard(client: SupabaseClient, placeId: string): Promise<void> {
  await invokeEF<{ ok: boolean }>(client, "consumer-web-remove-loyalty-card", { place_id: placeId });
}

/** Whether the Wallet offers "Remove from Wallet" (MESITA-3605): a card the
 *  guest pinned that holds nothing and has no history. A card with history
 *  shows by its entries, so removing the pin would change nothing. The
 *  server checks the money again; this only decides the button. */
export function canRemoveLoyaltyCard(b: WalletBalance | null): boolean {
  if (!b || b.pinned !== true) return false;
  return (
    b.balance_cents === 0 &&
    b.available_cents === 0 &&
    b.pending_cents === 0 &&
    b.spendable_cents === 0 &&
    b.entries.length === 0
  );
}

/** What Stripe.js needs to finish a voucher paid with a saved card
 *  (MESITA-3552): the same shape as a bill's card part, so runBankCheck
 *  (lib/api/tab.ts) runs it. */
export type VoucherCardStep = {
  status: "succeeded" | "processing" | "requires_action";
  payment_intent_id: string;
  client_secret?: string;
  stripe_account?: string;
  publishable_key?: string;
};

/** Buys vouchers at a place with a SAVED CARD (MESITA-3552; required since
 *  MESITA-4065, there is no Stripe page). MESITA-3841 a basket (`items`,
 *  every voucher with its quantity) paid with ONE charge, all or nothing.
 *  The `request_id` is one per basket and card: every retry after an unknown
 *  outcome carries the same, so the server finds the same purchase and never
 *  charges twice; after a bank check it answers how the card payment ended.
 *  Refusals arrive as EFError with a code from BUY_REFUSAL. */
export async function apiBuyVoucher(
  client: SupabaseClient,
  args: {
    place_id: string;
    request_id: string;
    card_pm_id: string;
  } & ({ voucher: VoucherKey; items?: never } | { items: Array<{ voucher: VoucherKey; qty: number }>; voucher?: never }),
): Promise<{ purchase_id: string; card: VoucherCardStep }> {
  return await invokeEF<{ purchase_id: string; card: VoucherCardStep }>(client, "consumer-web-buy-voucher", args);
}

/** MESITA-4384: what the Apple Pay / Google Pay button needs, or why it
 *  stays hidden (`available: false` with the refusal's code). */
export type ExpressSetup =
  | {
    available: true;
    wallets: Array<"apple_pay" | "google_pay">;
    publishable_key: string;
    stripe_account: string;
    /** Stripe's units, exactly the PaymentIntent's amount. */
    amount_cents: number;
    currency: string;
    country: string;
    label: string;
  }
  | { available: false; code: string };

/** An express purchase's step (consumer-web-buy-voucher with `express`). */
export type ExpressStep =
  | { status: "succeeded"; payment_intent_id: string; pay_with: "apple_pay" | "google_pay" | "express" }
  | { status: "processing"; payment_intent_id: string }
  | {
    status: "requires_payment_method" | "requires_action";
    payment_intent_id: string;
    client_secret: string;
    stripe_account: string;
    publishable_key: string;
    amount_cents: number;
    decline_code?: string;
    error?: string;
  };

export type ExpressBasket = { place_id: string } & (
  | { voucher: VoucherKey; items?: never }
  | { items: Array<{ voucher: VoucherKey; qty: number }>; voucher?: never }
);

export async function apiExpressSetup(
  client: SupabaseClient,
  /** MESITA-4386: a bill's card part (plus tip) instead of a voucher basket. */
  args: ExpressBasket,
): Promise<ExpressSetup> {
  return await invokeEF<ExpressSetup>(client, "consumer-web-express-pay-setup", args);
}

/** Opens an express purchase, or (the same request_id again) reads where it
 *  stands: the browser confirms in between. */
export async function apiBuyVoucherExpress(
  client: SupabaseClient,
  args: ExpressBasket & { request_id: string },
): Promise<{ purchase_id: string; express: ExpressStep }> {
  return await invokeEF<{ purchase_id: string; express: ExpressStep }>(client, "consumer-web-buy-voucher", { ...args, express: true });
}

/** What the guest reads when the buy is refused, by the server's code. */
export const BUY_REFUSAL: Record<string, string> = {
  sign_in: "Sign in to buy a voucher.",
  no_account: "This place isn't taking payments yet.",
  currency_mismatch: "This place can't sell vouchers in its currency yet.",
  paused: "Voucher sales are paused for a moment. Try again later.",
  not_available: "This place doesn't sell that voucher.",
  not_yet: "This voucher isn't on sale yet.",
  needs_card_payments: "This voucher arrives with card payments.",
  welcome_used: "You already had your Welcome voucher here.",
  needs_visit: "One per visit. Pay a bill here by card to buy another.",
  // MESITA-4641: a voucher no longer sold; nothing was charged.
  voucher_retired: "This voucher isn't sold any more.",
  // The retired VIP voucher's two refusals (MESITA-4640, MESITA-4659); the
  // buy door says voucher_retired first. No VIP words since MESITA-4709.
  not_vip: "This voucher isn't sold any more.",
  vip_recheck: "This voucher isn't sold any more.",
  below_minimum: "This amount is below the card minimum.",
  place_cap: "This place can't take more credit for now. Try again later.",
  in_progress: "Your purchase is already on its way.",
  // A saved card (MESITA-3552; required since MESITA-4065)
  card_required: "Add a card to buy credit.",
  card_not_found: "That card was removed. Choose another card.",
  card_declined: "Your card was declined. Nothing was charged. Try another card.",
  card_needs_auth: "This card needs a bank check we can't show. Try another card.",
  card_failed: "Couldn't charge the card. Nothing was charged. Try again.",
  stripe_unreachable: "We couldn't reach the bank. Try again.",
  // Retries after an unknown outcome ran out (MESITA-4065).
  unconfirmed: "We couldn't confirm the payment. Check Wallet before trying again.",
  // MESITA-4647: the basket changed while the last payment is unconfirmed.
  unconfirmedChanged: "We're still checking your last payment. Pay the same vouchers again, or check Wallet.",
  failed: "Couldn't complete the purchase. Try again.",
  closed: "That purchase was cancelled. Tap Pay to start over.",
  // MESITA-4384: express pay's kill switch, flipped while the sheet was open.
  disabled: "Apple Pay and Google Pay are off right now. Pay with a card.",
  payments_unavailable: "Payments aren't available right now. Try again later.",
};

/** What a refused buy does (MESITA-3549; MESITA-4065). card_required opens
 *  the card sheet; card_not_found lists the cards again and asks for another;
 *  place_cap only says its line (the offer has not changed); anything else
 *  says its line and reloads the offer. Never computes money. */
export type BuyRefusalAction =
  | { kind: "add_card"; line: string }
  | { kind: "reload_cards"; line: string }
  | { kind: "say"; line: string; reload: boolean };

export function buyRefusalAction(code: string | null): BuyRefusalAction {
  if (code === "card_required") return { kind: "add_card", line: BUY_REFUSAL.card_required };
  if (code === "card_not_found") return { kind: "reload_cards", line: BUY_REFUSAL.card_not_found };
  const line = (code && BUY_REFUSAL[code]) || BUY_REFUSAL.failed;
  return { kind: "say", line, reload: code !== "place_cap" };
}

/** Whether a refusal is definitive (MESITA-4065): a 4xx is the server's
 *  answer, so the next tap starts a new request_id; anything else (no
 *  answer, 5xx, card_failed, stripe_unreachable) may have charged, so the
 *  retry carries the same one. */
export function isDefinitiveRefusal(status: number | null, code: string | null): boolean {
  if (code === "card_failed" || code === "stripe_unreachable") return false;
  return status !== null && status >= 400 && status < 500;
}

/** "$500.00MX" / "$25.00" — always two decimals (MESITA-3767). One formatter with the
 *  staff's proof page (web-visit), so both screens print the same peso. */
export const money = moneyLabel;

// ── Paying from credit (MESITA-3304, W2a) ───────────────────────────────────

/** A payment as the Pay tab shows it: the proof once paid. MESITA-4708: a
 *  bill has no card part, so no Checkout to resume. */
export type PayProof = {
  payment_id: string;
  place_name: string | null;
  /** The place's Premier tier and Mesita Payments mark beside its name
   *  (MESITA-3539), when known. */
  place_marks?: { tier: number | null; mesita_pay: boolean } | null;
  /** The row's state: open (a bill paid outside, waiting for the waiter),
   *  paid, refunded, partly_refunded, expired, failed, needs_review. */
  status: string;
  amount_cents: number;
  /** The parts (MESITA-3305); card_cents is 0 since MESITA-4708. */
  credit_cents?: number;
  card_cents?: number;
  tip_cents?: number;
  /** How much was refunded, when the server sends it: a partial refund
   *  reads "Refunded MX$N" (else "Partly refunded"). */
  refunded_cents?: number;
  /** The ticket number the guest typed, when the server sends it. */
  ticket?: string | null;
  currency: string;
  /** Null while the payment is still open. */
  paid_at: string | null;
  /** When staff marked the proof seen on service.mesita.ai. */
  proof_seen_at: string | null;
  proof: { token: string; url: string } | null;
  expires_at?: string | null;
  test_mode: boolean;
};

type Started = {
  payment_id: string;
  status: string;
  outcome: "paid" | "already_paid";
  amount_cents?: number;
  credit_cents?: number;
  currency?: string;
  paid_at?: string;
  proof?: { token: string; url: string } | null;
  test_mode: boolean;
};

/** What a start answers: a paid proof, or a payment already settled under
 *  this request id, to read back. */
export type PayStart =
  | { kind: "paid"; proof: PayProof }
  | { kind: "already_paid"; payment_id: string };

/** Pays the place from credit (MESITA-4708: the card part through Stripe
 *  Checkout is gone). Refusals arrive as EFError with a code from
 *  PAY_REFUSAL; `insufficient` carries `spendable_cents`, `taken` the
 *  `payment_id` that already went through (EFError.body). */
export async function apiStartPayment(
  client: SupabaseClient,
  args: {
    place_id: string;
    place_name: string | null;
    place_marks?: { tier: number | null; mesita_pay: boolean } | null;
    amount_cents: number;
    request_id: string;
    ticket: string | null;
    /** The waiter's 4-digit code (MESITA-3306): the charge sets the amount
     *  and the ticket; the server refuses any other amount. */
    charge_code?: string;
  },
): Promise<PayStart> {
  const r = await invokeEF<Started>(client, "consumer-web-start-payment", {
    place_id: args.place_id,
    amount_cents: args.amount_cents,
    request_id: args.request_id,
    ...(args.ticket ? { ticket: args.ticket } : {}),
    ...(args.charge_code ? { charge_code: args.charge_code } : {}),
  });
  if (!("outcome" in r) || r.paid_at === undefined) return { kind: "already_paid", payment_id: r.payment_id };
  return {
    kind: "paid",
    proof: {
      payment_id: r.payment_id,
      place_name: args.place_name,
      place_marks: args.place_marks ?? null,
      status: r.status,
      amount_cents: r.amount_cents ?? args.amount_cents,
      credit_cents: r.credit_cents,
      ticket: args.ticket,
      currency: r.currency ?? "mxn",
      paid_at: r.paid_at,
      proof_seen_at: null,
      proof: r.proof ?? null,
      test_mode: r.test_mode,
    },
  };
}

/** One of the guest's payments: its proof again and whether staff saw it. */
export async function apiGetPayment(client: SupabaseClient, paymentId: string): Promise<PayProof> {
  const r = await invokeEF<
    Omit<PayProof, "place_name" | "place_marks"> & {
      place: { id: string; name: string | null; marks?: { tier: number | null; mesita_pay: boolean } };
    }
  >(
    client,
    "consumer-web-get-payment",
    { payment_id: paymentId },
  );
  return {
    payment_id: r.payment_id,
    place_name: r.place?.name ?? null,
    place_marks: r.place?.marks ?? null,
    status: r.status,
    amount_cents: r.amount_cents,
    credit_cents: r.credit_cents,
    card_cents: r.card_cents,
    tip_cents: r.tip_cents,
    refunded_cents: r.refunded_cents,
    ticket: r.ticket ?? null,
    currency: r.currency,
    paid_at: r.paid_at,
    proof_seen_at: r.proof_seen_at,
    proof: r.proof,
    expires_at: r.expires_at,
    test_mode: r.test_mode,
  };
}

/** What the guest reads when a payment is refused, by the server's code.
 *  `insufficient` prints the server's spendable_cents instead. */
export const PAY_REFUSAL: Record<string, string> = {
  sign_in: "Sign in to pay.",
  amount_required: "Type an amount to pay.",
  above_cap: "That's more than one payment can be.",
  gone: "This place can't take payments.",
  taken: "This payment already went through.",
  // MESITA-4708: a bill has no card part.
  cards_off: "Pay the rest with cash or the place's own terminal.",
};

// ── The waiter's charge (MESITA-3306) ───────────────────────────────────────

/** What a waiter's code names: the amount the guest pays, locked, and the
 *  ticket staff typed. */
export type WaiterCharge = { amount_cents: number; currency: string; ticket: string | null; expires_at: string };

/** Reads the charge a code names; moves no money. A wrong code is one try:
 *  refusals arrive as EFError with a code from CHARGE_REFUSAL. */
export async function apiLookCharge(client: SupabaseClient, placeId: string, code: string): Promise<WaiterCharge> {
  const r = await invokeEF<{ charge: WaiterCharge }>(client, "consumer-web-start-payment", {
    place_id: placeId,
    charge_code: code,
    look: true,
  });
  return r.charge;
}

/** What the guest reads when a waiter's code is refused. */
export const CHARGE_REFUSAL: Record<string, string> = {
  gone: "That code isn't open here. Ask the waiter for it again.",
  taken: "Someone else is paying this charge.",
  locked: "Too many wrong codes.",
};

// ── The Pay tab's list (MESITA-3457) ────────────────────────────────────────

/** One place the guest can pay at now: their credit there, whether a bill
 *  can be paid outside, its offers, and the last 12 hours' payment. Every
 *  number is the server's. */
export type PayPlace = {
  place_id: string;
  name: string | null;
  /** The profile picture, the Wallet cards' round photo (MESITA-3536). */
  photo: string | null;
  /** The street address as the place reads it. */
  address: string | null;
  marks: { tier: number | null; mesita_pay: boolean };
  /** Null without a location, or for a place with no coordinates. */
  distance_m: number | null;
  currency: string;
  /** Spendable now: Available minus credit held by open payments. */
  available_cents: number;
  pending_cents: number;
  test_mode: boolean;
  paid_recent: { payment_id: string; total_cents: number; paid_at: string } | null;
  /** Cash Payments is on here (the owner's switch and a waiter code). */
  outside_ok?: boolean;
  /** MESITA-4698: Loyalty Cards is On, so the place has offers (Get Discounts). */
  offers_ok?: boolean;
  /** What the guest can buy here now (MESITA-4519), the card's offer
   *  slides, plus the Pay (cashback) offer the server already sends
   *  (MESITA-4731). Absent from an older server reads as none. */
  offers?: {
    sell: string[];
    cashback_pct?: number | null;
    cashback_flat?: boolean;
    /** MESITA-4748/4766: the three Back lines apart, for the Pay Bill
     *  sheet's boxes; null = that line is Off. Absent from an older server
     *  reads as no boxes. `cashback_pct` is the highest of the three. */
    welcome_pct?: number | null;
    returning_pct?: number | null;
    returning_vip_pct?: number | null;
    /** MESITA-4789: a VIP's first bill here; absent from an older server
     *  reads welcome_pct (what a VIP got then). */
    welcome_vip_pct?: number | null;
    /** MESITA-4770: Discount (off this bill) or Cashback (credit back) for
     *  the three lines. Absent from an older server reads as cashback. */
    visit_mechanism?: "discount" | "cashback";
    /** MESITA-4764: each voucher's bonus here in whole percent. */
    voucher_pct?: Record<string, number>;
  };
  /** MESITA-4770: the line this guest's next bill here falls in. */
  visit_line?: "welcome" | "welcome_vip" | "returning" | "returning_vip";
};

/** MESITA-4770: the visit discount this guest's next bill here gets, in
 *  basis points (0 = none: cashback, Off, or an older server). The server
 *  (pay_guest_begin) decides the same and has the last word. */
export function payPlaceDiscountBps(p: PayPlace | null): number {
  return p?.offers?.visit_mechanism === "discount" ? visitBps(p) : 0;
}

/** MESITA-4813: the Cashback this guest's next bill here earns, in basis
 *  points (0 = none). pay_tab_grant_cashback decides the same. */
export function payPlaceCashbackBps(p: PayPlace | null): number {
  return p?.offers && p.offers_ok && p.offers.visit_mechanism !== "discount" ? visitBps(p) : 0;
}

function visitBps(p: PayPlace): number {
  const o = p.offers;
  if (!o) return 0;
  const line = p.visit_line;
  const pct =
    line === "returning_vip" ? o.returning_vip_pct
    : line === "returning" ? o.returning_pct
    : line === "welcome_vip" ? (o.welcome_vip_pct !== undefined ? o.welcome_vip_pct : o.welcome_pct)
    : o.welcome_pct;
  return pct && pct > 0 ? Math.round(pct * 100) : 0;
}

/** A printed bill's discount, rounded down (pay_guest_begin's sum). */
export function discountOf(billCents: number, bps: number): number {
  return bps > 0 && billCents > 0 ? Math.floor((billCents * bps) / 10000) : 0;
}

/** Which of a place's Offers tabs have something on (MESITA-4731, D5;
 *  Post left with Stories, MESITA-4766). */
export function payPlaceTabs(p: PayPlace): { prepay: boolean; pay: boolean } {
  const o = p.offers;
  return {
    prepay: (o?.sell?.length ?? 0) > 0,
    pay: (o?.cashback_pct ?? 0) > 0,
  };
}

/** The places, credit first then nearest. `at` is rounded by the caller and
 *  never stored by the server. A `bad_location` answer is retried once
 *  without it. */
export async function apiListPayPlaces(
  client: SupabaseClient,
  at: { lat: number; lng: number } | null,
): Promise<PayPlace[]> {
  try {
    const r = await invokeEF<{ places: PayPlace[] }>(client, "consumer-web-list-pay-places", at ? { lat: at.lat, lng: at.lng } : {});
    return r.places ?? [];
  } catch (e) {
    if (at && (e as { code?: string }).code === "bad_location") return await apiListPayPlaces(client, null);
    throw e;
  }
}

/** One tap's request id. A retry of the same place and amount keeps it (the
 *  server replays it to the payment that went through); a new place or
 *  amount mints a fresh one, since the server reads a kept id with another
 *  amount as `taken`. The page drops it after any answer with a code. */
export type PayAttempt = { requestId: string; placeId: string; amountCents: number };

export function attemptFor(
  prev: PayAttempt | null,
  placeId: string,
  amountCents: number,
  mint: () => string = () => crypto.randomUUID(),
): PayAttempt {
  if (prev && prev.placeId === placeId && prev.amountCents === amountCents) return prev;
  return { requestId: mint(), placeId, amountCents };
}

/** "Nov 1, 2026". */
export function entryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const ENTRY_LABEL: Record<string, string> = {
  prepay: "Prepaid",
  // The paid part of a voucher; its bonus is its own "Bonus" row (MESITA-4257).
  // "Credits received" for an hour, then Pato: "Yes, say Voucher" (MESITA-4261).
  voucher: "Voucher",
  bonus: "Bonus",
  // MESITA-4698: earned on a paid bill, Pending 1 hour (MESITA-4717).
  // "Cashback" again (Pato, 2026-11-23, MESITA-4777: "back is too complex
  // to understand"; "Back" since MESITA-4725).
  cashback: "Cashback",
  // MESITA-4714's story reward; Stories left (MESITA-4766) but paid entries
  // stay in the guest's history under this name.
  story: "Instagram Story credit",
  spend: "Paid",
  reversal: "Refund",
  // Credit given back on a payment (MESITA-3750: it showed the raw word).
  refund: "Refund",
  // Sending credit to a friend (MESITA-3292)
  gift_out: "Sent to a friend",
  gift_in: "From a friend",
  gift_back: "Taken back",
};

/** An entry's label (MESITA-3750). A reversal reads from what it carries: a
 *  purchase_id is a refunded purchase; a payment_id is a refunded bill's
 *  credit taken back. The wallet_entries CHECK requires one of the two on
 *  every reversal, so the plain "Refund" fallback is defensive only. */
export function entryLabel(e: Pick<WalletEntry, "kind" | "purchase_id" | "payment_id" | "reason">): string {
  if (e.kind === "reversal") {
    if (e.purchase_id) return "Purchase refunded";
    if (e.payment_id) return "Credit taken back";
    return "Refund";
  }
  // A Back entry names its line (MESITA-4766): "Back · Returning VIP".
  if (e.kind === "cashback" && e.reason && BACK_LINE_LABEL[e.reason]) return `${ENTRY_LABEL.cashback} · ${BACK_LINE_LABEL[e.reason]}`;
  return ENTRY_LABEL[e.kind] ?? e.kind;
}

/** The lines by a cashback entry's `reason` (MESITA-4766), in Pato's four
 *  tier names since MESITA-4789. */
export const BACK_LINE_LABEL: Record<string, string> = {
  welcome: "Welcome Visit",
  returning: "Returning Visit",
  welcome_vip: "VIP Welcome Visit",
  returning_vip: "VIP Returning Visit",
};

// ── Sending credit to a friend (MESITA-3292) ────────────────────────────────

/** A link the guest sent that nobody took yet. */
/** One side of a gift (MESITA-4036): a first name and a photo (none when
 *  they have none); `you` is the guest reading it. */
export type GiftPerson = { name: string; photo: string | null; you: boolean };

/** A gift sent or received (MESITA-4036, the server's _shared/wallet-gifts.ts):
 *  open = nobody took it yet, claimed = a friend took it, taken_back = the
 *  sender took it back first. The recipient is null until someone takes it. */
export type GiftTicket = {
  gift_id: string;
  place_id: string;
  place: WalletBalance["place"];
  amount_cents: number;
  currency: string;
  status: "open" | "claimed" | "taken_back";
  role: "sender" | "recipient";
  created_at: string;
  claimed_at: string | null;
  taken_back_at: string | null;
  sender: GiftPerson;
  recipient: GiftPerson | null;
  /** `available_at`: when a received gift's credit turns Available
   *  (MESITA-4066); absent from a server before it. */
  entry: { kind: string; at: string; available_at?: string | null } | null;
};

export type SentLink = {
  gift_id: string;
  place_id: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  /** Its link can be shown again (MESITA-4390); false for a link sent
   *  before, which can only be taken back. Absent from an older server. */
  can_share?: boolean;
};

/** The link a friend opens, short (MESITA-4390, Pato: "the link must only
 *  be mesita.ai/g/abcdef"): this app's host, no scheme, /g/<key>. /g/<key>
 *  forwards to the Wallet with the key, /wallet/gift/<key> (next.config). */
export function giftLink(token: string, host: string = typeof window === "undefined" ? "" : window.location.host): string {
  return `${host}${GIFT_SHORT_PREFIX}${encodeURIComponent(token)}`;
}

/** The short link's path prefix (MESITA-4390). */
export const GIFT_SHORT_PREFIX = "/g/";

/** An open gift's link again, for its sender (MESITA-4390). `token` is null
 *  for a link sent before links could be shown again: take it back. */
export async function apiGetGiftLink(
  client: SupabaseClient,
  giftId: string,
): Promise<{ gift_id: string; amount_cents: number; currency: string; token: string | null }> {
  return await invokeEF(client, "consumer-web-get-gift-link", { gift_id: giftId });
}

/** Sends credit at one place as a one-time link (a link only since
 *  MESITA-4223; MESITA-3737's 12-digit code is gone). `token` is null on a
 *  replay (the server keeps only its hash). Refusals arrive as EFError with a code from
 *  GIFT_REFUSAL. */
export async function apiSendCredit(
  client: SupabaseClient,
  args: { place_id: string; amount_cents: number; request_id: string },
): Promise<{
  outcome: "sent" | "already_sent";
  gift_id: string;
  amount_cents: number;
  currency: string;
  token: string | null;
}> {
  return await invokeEF(client, "consumer-web-send-credit", args);
}

export async function apiTakeBackCredit(client: SupabaseClient, giftId: string): Promise<{ amount_cents: number; currency: string }> {
  return await invokeEF(client, "consumer-web-take-back-credit", { gift_id: giftId });
}

/** What a credit link holds, read without taking it. */
export type GiftLook = {
  status: "open" | "claimed" | "taken_back";
  amount_cents: number;
  currency: string;
  /** The caller sent it. */
  mine: boolean;
  /** The caller already took it. */
  yours: boolean;
  place: WalletBalance["place"];
};

export async function apiLookGift(client: SupabaseClient, token: string): Promise<GiftLook> {
  const r = await invokeEF<{ gift: GiftLook }>(client, "consumer-web-claim-credit", { token, look: true });
  return r.gift;
}

export async function apiClaimGift(
  client: SupabaseClient,
  token: string,
): Promise<{ outcome: "claimed" | "already_claimed"; place_id: string; amount_cents: number; currency: string }> {
  return await invokeEF(client, "consumer-web-claim-credit", { token });
}

/** What the guest reads when sending or taking credit is refused. */
export const GIFT_REFUSAL: Record<string, string> = {
  sign_in: "Sign in first.",
  not_live: "Sending credit isn't open yet.",
  amount_required: "Type an amount to send.",
  above_cap: "That's more than one link can carry.",
  insufficient: "That's more than you can send here.",
  too_many_open: "You have 10 links waiting here. Take one back first.",
  taken: "That link was already sent.",
  gone: "That link isn't here.",
  claimed: "Someone already took this credit.",
  taken_back: "Your friend took this credit back.",
  own_gift: "This is your own link. Send it to a friend.",
  too_many_tries: "Too many wrong links. Try again in an hour.",
};
