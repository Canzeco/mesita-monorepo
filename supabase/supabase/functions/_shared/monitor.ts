// MONITOR LISTS (MESITA-4538, Pato: "SIMPLE LISTS … the lists have ids and
// those ids redirect to other tickets across the Monitor subpages").
// Shared by business-web-list-place-monitor, -list-place-customers and
// -get-place-payouts: request parsing, masking, and the payouts read. Every
// name a place sees passes maskGuest; the email never leaves the server.

import { maskGuest } from "./money-admin.ts";
import type { StripeCall } from "./stripe.ts";
import { StripeError } from "./stripe.ts";

export const MONITOR_KINDS = ["visits", "vouchers", "payments", "credits", "stories"] as const;
export type MonitorKind = (typeof MONITOR_KINDS)[number];

/** A per-place guest key: md5 hex (place_customer_key). */
export function isCustomerKey(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

type RawRow = Record<string, unknown> & {
  guest_name?: string | null;
  guest_email?: string | null;
  other_name?: string | null;
  other_email?: string | null;
  customer?: string | null;
  other_customer?: string | null;
};

/** One list row as the page receives it: names masked, emails dropped. */
export function maskMonitorRow(row: RawRow): Record<string, unknown> {
  const { guest_name, guest_email, other_name, other_email, ...rest } = row;
  return {
    ...rest,
    guest: row.customer ? maskGuest(guest_name, guest_email) : null,
    other: row.other_customer ? maskGuest(other_name, other_email) : null,
  };
}

// ── Payouts ───────────────────────────────────────────────────────────────

export type Payout = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  arrival_date: string | null;
  created: string | null;
  bank: string | null;
  failure_message: string | null;
};

export type PayoutsAnswer =
  | { state: "ok"; payouts: Payout[]; next: string | null }
  | { state: "no_account" }
  | { state: "stripe_error" };

function iso(sec: unknown): string | null {
  return typeof sec === "number" ? new Date(sec * 1000).toISOString() : null;
}

/** "STRIPE TEST BANK ••7897" from an expanded bank account or card. */
export function payoutBank(destination: unknown): string | null {
  if (!destination || typeof destination !== "object") return null;
  const d = destination as Record<string, unknown>;
  const last4 = typeof d.last4 === "string" ? d.last4 : null;
  const name = typeof d.bank_name === "string" ? d.bank_name : typeof d.brand === "string" ? d.brand : null;
  if (!name && !last4) return null;
  return [name, last4 ? `••${last4}` : null].filter(Boolean).join(" ");
}

/** Ten payouts on the place's connected account, newest first. A Stripe
 *  failure is an answer, never a 500: the payments list still shows. */
export async function readPayouts(
  stripe: StripeCall,
  account: string | null,
  startingAfter: string | null,
): Promise<PayoutsAnswer> {
  if (!account) return { state: "no_account" };
  try {
    const list = await stripe(
      "GET",
      "payouts",
      { limit: 10, expand: ["data.destination"], ...(startingAfter ? { starting_after: startingAfter } : {}) },
      { stripeAccount: account },
    );
    const data = Array.isArray(list.data) ? (list.data as Array<Record<string, unknown>>) : [];
    const payouts = data.map((p) => ({
      id: String(p.id),
      amount_cents: Number(p.amount ?? 0),
      currency: String(p.currency ?? "mxn"),
      status: String(p.status ?? ""),
      arrival_date: iso(p.arrival_date),
      created: iso(p.created),
      bank: payoutBank(p.destination),
      failure_message: typeof p.failure_message === "string" ? p.failure_message : null,
    }));
    const next = list.has_more === true && payouts.length ? payouts[payouts.length - 1].id : null;
    return { state: "ok", payouts, next };
  } catch (err) {
    if (err instanceof StripeError) {
      console.error(`[payouts] account=${account} stripe_error=${err.message}`);
      return { state: "stripe_error" };
    }
    throw err;
  }
}
