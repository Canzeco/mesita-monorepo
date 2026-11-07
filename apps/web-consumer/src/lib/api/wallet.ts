// Wallet — the guest's credit at each place (MESITA-3097/3098; on the
// place's own Stripe Connect account since MESITA-3302). Every amount and
// outcome comes from the server: this file never computes money, it only
// formats it. Buying a voucher arrives with MESITA-3303 (W1b).

import type { SupabaseClient } from "@supabase/supabase-js";
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
  balances: WalletBalance[];
  outcome?: PrepayOutcome;
};

export async function apiGetWallet(client: SupabaseClient, sessionId?: string): Promise<Wallet> {
  return await invokeEF<Wallet>(client, "consumer-web-get-wallet", {
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

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
