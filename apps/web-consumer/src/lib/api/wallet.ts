// Wallet — the guest's credit at each place (MESITA-3097/3098; on the
// place's own Stripe Connect account since MESITA-3302; vouchers bought
// here since MESITA-3303). Every amount and outcome comes from the server:
// this file never computes money, it only formats it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { placeMoneyFrom, type PlaceMoney, type VoucherKey } from "@mesita/place-profile";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { walletGiftPath } from "@/lib/consumer-route-contract";
import { invokeEF } from "./_invoke";

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
  /** Who confirmed a cashback's payment (MESITA-3554): 'waiter' is a bill
   *  paid in cash at the table. Null on other entries; absent from a server
   *  before MESITA-3554. */
  confirmed_by?: string | null;
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
  /** The place can take a card part (MESITA-3305): its Stripe account
   *  charges and the owner's Cards switch is on. Absent reads as no. */
  card_ok?: boolean;
  last_at: string;
  entries: WalletEntry[];
  /** The guest added this card by hand (MESITA-3582). Absent reads as no. */
  pinned?: boolean;
};

/** What happened to the Checkout the guest came back from. */
export type PrepayOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none";

/** A paid Story voucher staff have not activated yet (MESITA-3507): no
 *  credit until they see the guest's story and scan this QR. */
export type WaitingStory = {
  purchase_id: string;
  place: WalletBalance["place"];
  place_id: string;
  credit_cents: number;
  currency: string;
  paid_at: string | null;
  url: string;
};

export type Wallet = {
  /** Stripe is in test mode: the TestBand shows, no real money moves. */
  test_mode?: boolean;
  balances: WalletBalance[];
  /** Absent from a server before MESITA-3507: reads as none. */
  waiting_stories?: WaitingStory[];
  /** Credit links the guest sent that nobody took yet (MESITA-3292): the
   *  amount is already off their balance; they can take it back. */
  sent_links?: SentLink[];
  /** Sending credit is open here (MESITA-3292): always in test mode; live
   *  once the lawyer answers. Absent reads as no. */
  can_send?: boolean;
  outcome?: PrepayOutcome;
  /** The read ran out of time confirming a purchase with Stripe; it is
   *  confirmed on the next read or by the server on its own. */
  settling?: boolean;
};

export async function apiGetWallet(client: SupabaseClient, sessionId?: string): Promise<Wallet> {
  return await invokeEF<Wallet>(client, "consumer-web-get-wallet", {
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** The place's offer and the caller's credit there (the Vouchers tab).
 *  `inWallet` (MESITA-3582): this place's House Card is already in the
 *  signed-in caller's Wallet; undefined when signed out or unknown. */
export async function apiListVouchers(
  client: SupabaseClient,
  placeId: string,
): Promise<{ money: PlaceMoney | undefined; inWallet: boolean | undefined }> {
  const r = await invokeEF<{ money: unknown; in_wallet?: unknown }>(client, "consumer-web-list-vouchers", { place_id: placeId });
  return { money: placeMoneyFrom(r.money), inWallet: typeof r.in_wallet === "boolean" ? r.in_wallet : undefined };
}

/** Pins a place's House Card to the guest's Wallet with $0 (MESITA-3582).
 *  `already`: it was pinned before. */
export async function apiAddHouseCard(client: SupabaseClient, placeId: string): Promise<{ already: boolean }> {
  const r = await invokeEF<{ already?: boolean }>(client, "consumer-web-add-house-card", { place_id: placeId });
  return { already: r.already === true };
}

/** Takes a pinned $0 House Card off the guest's Wallet (MESITA-3605). The
 *  server refuses with code has_credit when the guest holds anything there. */
export async function apiRemoveHouseCard(client: SupabaseClient, placeId: string): Promise<void> {
  await invokeEF<{ ok: boolean }>(client, "consumer-web-remove-house-card", { place_id: placeId });
}

/** Whether the Wallet offers "Remove from Wallet" (MESITA-3605): a card the
 *  guest pinned that holds nothing and has no history. A card with history
 *  shows by its entries, so removing the pin would change nothing. The
 *  server checks the money again; this only decides the button. */
export function canRemoveHouseCard(b: WalletBalance | null): boolean {
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

/** Buys one voucher on the place's own account. Without `card_pm_id` it
 *  opens Stripe Checkout (`url`); with a saved card's id it charges that
 *  card at once (`card`, MESITA-3552). The `request_id` is one per tap: a
 *  retry with the same id finds the same purchase, never a second charge,
 *  and after a bank check it answers how the card payment ended. Refusals
 *  arrive as EFError with a code from BUY_REFUSAL. */
export async function apiBuyVoucher(
  client: SupabaseClient,
  args: { place_id: string; voucher: VoucherKey; request_id: string; return_url: string; card_pm_id?: string | null },
): Promise<{ url?: string; purchase_id: string; card?: VoucherCardStep }> {
  const { card_pm_id, ...rest } = args;
  return await invokeEF<{ url?: string; purchase_id: string; card?: VoucherCardStep }>(client, "consumer-web-buy-voucher", {
    ...rest,
    ...(card_pm_id ? { card_pm_id } : {}),
  });
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
  needs_instagram: "Link your Instagram to buy the Story voucher.",
  few_followers: "The Story voucher is for Instagram accounts with more than 1,000 followers.",
  not_vip: "The VIP voucher is for VIP guests.",
  welcome_used: "You already had your Welcome voucher here.",
  needs_visit: "One per visit. Pay a bill here by card to buy another.",
  below_minimum: "This amount is below the card minimum.",
  place_cap: "This place can't take more credit for now. Try again later.",
  in_progress: "Your checkout for this voucher is still open.",
  checkout_failed: "Couldn't open checkout. Try again.",
  // A saved card (MESITA-3552)
  card_not_found: "That card isn't saved on your account anymore. Choose another.",
  card_declined: "Your card was declined. Nothing was charged. Try another card.",
  card_needs_auth: "This card needs a bank check we can't show. Try another card or Stripe's page.",
  card_failed: "Couldn't charge the card. Nothing was charged. Try again.",
  closed: "That purchase was cancelled. Tap Buy to start over.",
};

/** What a refused buy does (MESITA-3549). A refusal that carries the open
 *  Checkout's `url` (in_progress) resumes it; place_cap only says its line
 *  (the offer has not changed); anything else says its line and reloads the
 *  offer, which may have changed under the guest. Never computes money. */
export type BuyRefusalAction =
  | { kind: "open"; url: string }
  | { kind: "say"; line: string; reload: boolean };

export function buyRefusalAction(code: string | null, body: Record<string, unknown> | null): BuyRefusalAction {
  const url = body && typeof body.url === "string" && body.url.startsWith("https://") ? body.url : null;
  if (url) return { kind: "open", url };
  const line = (code && BUY_REFUSAL[code]) || BUY_REFUSAL.checkout_failed;
  return { kind: "say", line, reload: code !== "place_cap" };
}

/** "$500MX" / "$25" — whole amounts drop the cents. One formatter with the
 *  staff's proof page (web-visit), so both screens print the same peso. */
export const money = moneyLabel;

// ── Paying from credit (MESITA-3304, W2a) ───────────────────────────────────

/** A payment as the Pay tab shows it: the proof once paid; while a card
 *  part's Checkout is open (MESITA-3305), its url to resume and its expiry. */
export type PayProof = {
  payment_id: string;
  place_name: string | null;
  /** The place's Premier tier and Mesita Payments mark beside its name
   *  (MESITA-3539), when known. */
  place_marks?: { tier: number | null; mesita_pay: boolean } | null;
  /** The row's state: open (a card part's Checkout is still open), paid,
   *  refunded, partly_refunded, expired, failed, needs_review. */
  status: string;
  amount_cents: number;
  /** The parts (MESITA-3305); 0 on a credit-only payment. */
  credit_cents?: number;
  card_cents?: number;
  tip_cents?: number;
  cashback_cents?: number;
  /** How much was refunded, when the server sends it: a partial refund
   *  reads "Refunded MX$N" (else "Partly refunded"). */
  refunded_cents?: number;
  /** The ticket number the guest typed, when the server sends it. */
  ticket?: string | null;
  currency: string;
  /** Null while the card part is still open. */
  paid_at: string | null;
  /** When staff marked the proof seen on visit.mesita.ai. */
  proof_seen_at: string | null;
  proof: { token: string; url: string } | null;
  /** While open: the Checkout to resume, or null when Stripe no longer has it. */
  url?: string | null;
  expires_at?: string | null;
  test_mode: boolean;
};

type Started =
  | {
    payment_id: string;
    status: string;
    outcome: "paid" | "already_paid";
    amount_cents?: number;
    credit_cents?: number;
    currency?: string;
    paid_at?: string;
    proof?: { token: string; url: string } | null;
    test_mode: boolean;
  }
  | {
    payment_id: string;
    status: "open";
    url: string;
    expires_at: string;
    amount_cents: number;
    credit_cents: number;
    card_cents: number;
    tip_cents: number;
    currency: string;
    test_mode: boolean;
  };

/** What a start answers: a paid proof (credit only), a Checkout to open
 *  (a card part), or a payment already settled under this request id, to
 *  read back. */
export type PayStart =
  | { kind: "paid"; proof: PayProof }
  | { kind: "checkout"; payment_id: string; url: string; expires_at: string }
  | { kind: "already_paid"; payment_id: string };

/** Pays the place: from credit alone, or credit plus a card part (and a tip
 *  by card) through Stripe Checkout on the place's account. Refusals arrive
 *  as EFError with a code from PAY_REFUSAL; `insufficient` carries
 *  `spendable_cents`, `taken` the `payment_id` that already went through,
 *  `in_progress` the open Checkout's `url` (EFError.body). */
export async function apiStartPayment(
  client: SupabaseClient,
  args: {
    place_id: string;
    place_name: string | null;
    place_marks?: { tier: number | null; mesita_pay: boolean } | null;
    amount_cents: number;
    card_cents?: number;
    tip_cents?: number;
    return_url?: string;
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
    ...(args.card_cents ? { card_cents: args.card_cents, return_url: args.return_url } : {}),
    ...(args.tip_cents ? { tip_cents: args.tip_cents } : {}),
    ...(args.ticket ? { ticket: args.ticket } : {}),
    ...(args.charge_code ? { charge_code: args.charge_code } : {}),
  });
  if (r.status === "open" && "url" in r) return { kind: "checkout", payment_id: r.payment_id, url: r.url, expires_at: r.expires_at };
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

/** One of the guest's payments: its proof again and whether staff saw it;
 *  an open card part is settled on this read when Stripe says paid. */
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
    cashback_cents: r.cashback_cents,
    refunded_cents: r.refunded_cents,
    ticket: r.ticket ?? null,
    currency: r.currency,
    paid_at: r.paid_at,
    proof_seen_at: r.proof_seen_at,
    proof: r.proof,
    url: r.url,
    expires_at: r.expires_at,
    test_mode: r.test_mode,
  };
}

/** Back from a cancelled Checkout (MESITA-3458): the open session is
 *  expired and the credit hold released, so the form can pay again. The
 *  payment as it now stands, and the ticket it carried, so the form shows
 *  the same amount, tip and ticket. `paid` when Stripe had already taken the
 *  money; `pending` when Stripe still reports it open. */
export type PayRelease = {
  outcome: "released" | "paid" | "unchanged" | "pending";
  payment: PayProof;
  place_id: string | null;
  ticket: string | null;
};

export async function apiReleasePayment(client: SupabaseClient, paymentId: string): Promise<PayRelease> {
  const r = await invokeEF<
    Omit<PayProof, "place_name"> & { place: { id: string; name: string | null }; outcome: PayRelease["outcome"]; ticket: string | null }
  >(client, "consumer-web-release-payment", { payment_id: paymentId });
  return {
    outcome: r.outcome,
    place_id: r.place?.id ?? null,
    ticket: r.ticket ?? null,
    payment: {
      payment_id: r.payment_id,
      place_name: r.place?.name ?? null,
      status: r.status,
      amount_cents: r.amount_cents,
      credit_cents: r.credit_cents,
      card_cents: r.card_cents,
      tip_cents: r.tip_cents,
      cashback_cents: r.cashback_cents,
      currency: r.currency,
      paid_at: r.paid_at,
      proof_seen_at: r.proof_seen_at,
      proof: r.proof,
      test_mode: r.test_mode,
    },
  };
}

/** What the guest reads when a payment is refused, by the server's code.
 *  `insufficient` prints the server's spendable_cents instead; `in_progress`
 *  offers the open Checkout. */
export const PAY_REFUSAL: Record<string, string> = {
  sign_in: "Sign in to pay.",
  amount_required: "Type an amount to pay.",
  above_cap: "That's more than one payment can be.",
  gone: "This place can't take payments.",
  taken: "This payment already went through.",
  // The card part (MESITA-3305)
  below_minimum: "The card part is below the card minimum.",
  no_account: "This place isn't taking card payments yet.",
  cards_off: "This place isn't taking card payments right now.",
  currency_mismatch: "This place can't take card payments in its currency yet.",
  in_progress: "A card payment here is still open.",
  checkout_failed: "Couldn't open checkout. Try again.",
  locked: "Card payments here are paused for a few minutes.",
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

/** One place the guest can pay at now: their credit there, whether Mesita
 *  Pay takes a card part, the card minimum and cashback rate, and the last
 *  12 hours' payment. Every number is the server's. */
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
  card_ok: boolean;
  /** Spendable now: Available minus credit held by open payments. */
  available_cents: number;
  pending_cents: number;
  /** What a card part earns back here; 0 when Cashback is off. */
  cashback_bps: number;
  test_mode: boolean;
  /** Stripe's minimum on card + tip (the start refuses below it). */
  card_min_cents: number;
  paid_recent: { payment_id: string; total_cents: number; paid_at: string } | null;
  /** Cash Payments is on here (the owner's switch and a waiter code). */
  outside_ok?: boolean;
  /** What the cash bill part earns back once the waiter verifies it. */
  outside_bps?: number;
};

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
  voucher: "Voucher",
  bonus: "Bonus",
  cashback: "Cashback",
  spend: "Paid",
  reversal: "Refund",
  // Sending credit to a friend (MESITA-3292)
  gift_out: "Sent to a friend",
  gift_in: "From a friend",
  gift_back: "Taken back",
};

// ── Sending credit to a friend (MESITA-3292) ────────────────────────────────

/** A link the guest sent that nobody took yet. */
export type SentLink = { gift_id: string; place_id: string; amount_cents: number; currency: string; created_at: string };

/** The link a friend opens: this app's own Wallet with the key,
 *  /wallet/gift/<token> (MESITA-3614; links sent as /wallet?gift= forward). */
export function giftLink(token: string, origin: string = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}${walletGiftPath(token)}`;
}

/** Sends credit at one place as a one-time link. `token` is null on a
 *  replay (the server keeps only its hash). Refusals arrive as EFError with
 *  a code from SEND_REFUSAL. */
export async function apiSendCredit(
  client: SupabaseClient,
  args: { place_id: string; amount_cents: number; request_id: string },
): Promise<{ outcome: "sent" | "already_sent"; gift_id: string; amount_cents: number; currency: string; token: string | null }> {
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
};
