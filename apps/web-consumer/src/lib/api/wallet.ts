// Wallet — the guest's credit at each place (MESITA-3097/3098; on the
// place's own Stripe Connect account since MESITA-3302; vouchers bought
// here since MESITA-3303). Every amount and outcome comes from the server:
// this file never computes money, it only formats it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { placeMoneyFrom, type PlaceMoney, type VoucherKey } from "@mesita/place-profile";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { invokeEF } from "./_invoke";

export type WalletEntry = {
  kind: string;
  amount_cents: number;
  at: string;
  pending: boolean;
  /** A spend's payment (MESITA-3304): the Wallet links it to its proof. */
  payment_id?: string | null;
};

export type WalletBalance = {
  place_id: string;
  /** Null when the place is gone from the catalog's reach; the money stays. */
  place: { id: string; slug: string | null; name: string | null; photo: string | null } | null;
  /** Lowercase ISO 4217 ("mxn"). */
  currency: string;
  /** Everything, Available and Pending. */
  balance_cents: number;
  available_cents: number;
  pending_cents: number;
  /** What the Pay tab can spend there now: Available minus credit held by
   *  open payments, from the server (MESITA-3304). */
  spendable_cents: number;
  last_at: string;
  entries: WalletEntry[];
};

/** What happened to the Checkout the guest came back from. */
export type PrepayOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none";

export type Wallet = {
  /** Stripe is in test mode: the TestBand shows, no real money moves. */
  test_mode?: boolean;
  balances: WalletBalance[];
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

/** The place's offer and the caller's credit there (the Vouchers tab). */
export async function apiListVouchers(client: SupabaseClient, placeId: string): Promise<PlaceMoney | undefined> {
  const r = await invokeEF<{ money: unknown }>(client, "consumer-web-list-vouchers", { place_id: placeId });
  return placeMoneyFrom(r.money);
}

/** Opens Stripe Checkout for one voucher on the place's own account. The
 *  `request_id` is one per tap: a retry with the same id finds the same
 *  checkout. Refusals arrive as EFError with a code from BUY_REFUSAL. */
export async function apiBuyVoucher(
  client: SupabaseClient,
  args: { place_id: string; voucher: VoucherKey; request_id: string; return_url: string },
): Promise<{ url: string; purchase_id: string }> {
  return await invokeEF<{ url: string; purchase_id: string }>(client, "consumer-web-buy-voucher", args);
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
  needs_instagram: "This voucher arrives with the Instagram connection.",
  welcome_used: "You already had your Welcome voucher here.",
  below_minimum: "This amount is below the card minimum.",
  checkout_failed: "Couldn't open checkout. Try again.",
};

/** "MX$500" / "$25" — whole amounts drop the cents. One formatter with the
 *  staff's proof page (web-visit), so both screens print the same peso. */
export const money = moneyLabel;

// ── Paying from credit (MESITA-3304, W2a) ───────────────────────────────────

/** A paid payment as the Pay tab shows its proof. */
export type PayProof = {
  payment_id: string;
  place_name: string | null;
  /** The row's state: paid, refunded, partly_refunded. */
  status: string;
  amount_cents: number;
  currency: string;
  paid_at: string;
  /** When staff marked the proof seen on visit.mesita.ai. */
  proof_seen_at: string | null;
  proof: { token: string; url: string } | null;
  test_mode: boolean;
};

type Started = {
  payment_id: string;
  status: string;
  outcome: "paid" | "already_paid";
  amount_cents: number;
  credit_cents: number;
  currency: string;
  paid_at: string;
  proof: { token: string; url: string } | null;
  test_mode: boolean;
};

/** Pays the place from the guest's credit there. Refusals arrive as EFError
 *  with a code from PAY_REFUSAL; `insufficient` carries `spendable_cents`,
 *  `taken` the `payment_id` that already went through (EFError.body). */
export async function apiStartPayment(
  client: SupabaseClient,
  args: { place_id: string; place_name: string | null; amount_cents: number; request_id: string; ticket: string | null },
): Promise<PayProof> {
  const r = await invokeEF<Started>(client, "consumer-web-start-payment", {
    place_id: args.place_id,
    amount_cents: args.amount_cents,
    request_id: args.request_id,
    ...(args.ticket ? { ticket: args.ticket } : {}),
  });
  return {
    payment_id: r.payment_id,
    place_name: args.place_name,
    status: r.status,
    amount_cents: r.amount_cents,
    currency: r.currency,
    paid_at: r.paid_at,
    proof_seen_at: null,
    proof: r.proof,
    test_mode: r.test_mode,
  };
}

/** One of the guest's paid payments: its proof again, and whether staff saw it. */
export async function apiGetPayment(client: SupabaseClient, paymentId: string): Promise<PayProof> {
  const r = await invokeEF<Omit<PayProof, "place_name"> & { place: { id: string; name: string | null } }>(
    client,
    "consumer-web-get-payment",
    { payment_id: paymentId },
  );
  return {
    payment_id: r.payment_id,
    place_name: r.place?.name ?? null,
    status: r.status,
    amount_cents: r.amount_cents,
    currency: r.currency,
    paid_at: r.paid_at,
    proof_seen_at: r.proof_seen_at,
    proof: r.proof,
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
};

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
};
