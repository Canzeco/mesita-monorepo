// Wallet — prepaid balances (MESITA-3097/3098). A guest prepays money at one
// place (Mesita Prepay); Mesita collects it and the balance sits in the
// Wallet. Every amount and outcome comes from the server: this file never
// computes money, it only formats it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type WalletEntry = { kind: string; amount_cents: number; at: string };

export type WalletBalance = {
  place_id: string;
  /** Null when the place is gone from the catalog's reach; the money stays. */
  place: { id: string; slug: string | null; name: string | null; photo: string | null } | null;
  /** Lowercase ISO 4217 ("mxn"). */
  currency: string;
  balance_cents: number;
  last_at: string;
  entries: WalletEntry[];
};

/** What happened to the Checkout the guest came back from. */
export type PrepayOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none";

export type Wallet = {
  balances: WalletBalance[];
  /** The amounts the Prepay sheet offers first, per currency, in cents. */
  presets: Record<string, number[]>;
  outcome?: PrepayOutcome;
};

export async function apiGetWallet(client: SupabaseClient, sessionId?: string): Promise<Wallet> {
  return await invokeEF<Wallet>(client, "consumer-web-get-wallet", {
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** Opens Stripe Checkout for a prepayment; resolves to the page to send the
 *  guest to. */
export async function apiStartPrepay(
  client: SupabaseClient,
  input: { placeId: string; amountCents: number; returnUrl: string },
): Promise<{ url: string }> {
  return await invokeEF<{ url: string }>(client, "consumer-web-start-prepay", {
    place_id: input.placeId,
    amount_cents: input.amountCents,
    return_url: input.returnUrl,
  });
}

/** The amounts the sheet offers before the Wallet has been read once. Kept
 *  equal to `PREPAY_PRESETS` in supabase/functions/_shared/wallet.ts. */
export const PREPAY_PRESETS_FALLBACK: Record<string, number[]> = {
  mxn: [200_00, 500_00, 1_000_00],
  usd: [10_00, 25_00, 50_00],
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

export const ENTRY_LABEL: Record<string, string> = { prepay: "Prepaid" };
