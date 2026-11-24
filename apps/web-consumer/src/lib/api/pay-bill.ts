// Waiter-led pay, the guest's side (MESITA-4823). The guest shows one general
// QR; the waiter sends the bill; the guest accepts or declines. Every number
// is the server's: the screen never works one out.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BillState = "open" | "sent" | "accepted" | "confirming" | "paid" | "declined" | "cancelled" | "expired";

export type GuestBill = {
  id: string;
  state: BillState;
  version: number;
  currency: string;
  bill_cents: number | null;
  tip_cents: number;
  expires_at: string;
  attempt_id: string | null;
  tab_id: string | null;
  test_mode: boolean;
  place: { id: string; name: string | null; photo_url: string | null };
  quote: {
    mechanism: "cashback" | "discount";
    discount_bps: number;
    discount_cents: number;
    credit_cents: number;
    outside_bill_cents: number;
    tip_cents: number;
    /** What the guest pays the place, outside Mesita: the rest plus the tip. */
    outside_cents: number;
    cashback_bps: number;
    cashback_cents: number;
  } | null;
};

export type PayCode = { url: string; short: string; expires_at: string };

export async function apiGetPayCode(
  client: SupabaseClient,
  args: { mint?: boolean; bill_id?: string } = {},
): Promise<{ code: PayCode | null; bill: GuestBill | null }> {
  return await invokeEF<{ code: PayCode | null; bill: GuestBill | null }>(client, "consumer-web-get-pay-code", args);
}

export async function apiAnswerBill(
  client: SupabaseClient,
  args: { bill_id: string; action: "accept" | "decline" | "not_mine" | "cancel"; version?: number },
): Promise<{ outcome: string; attempt_id: string | null; tab_id: string | null; status: string | null }> {
  return await invokeEF(client, "consumer-web-answer-bill", args);
}

/** A bill that needs the guest: to answer, or to pay. */
export function billNeedsGuest(b: GuestBill | null): b is GuestBill {
  return !!b && (b.state === "sent" || b.state === "accepted" || b.state === "confirming");
}
