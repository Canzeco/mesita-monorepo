// Wallet — the guest's credit at each place (MESITA-3097/3098; on the
// place's own Stripe Connect account since MESITA-3302; vouchers bought
// here since MESITA-3303). Every amount and outcome comes from the server:
// this file never computes money, it only formats it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { placeMoneyFrom, type PlaceMoney, type VoucherKey } from "@mesita/place-profile";
import { invokeEF } from "./_invoke";

export type WalletEntry = { kind: string; amount_cents: number; at: string; pending: boolean };

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

/** "MX$500" / "$25" — whole amounts drop the cents. */
export function money(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${code}`;
  }
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
