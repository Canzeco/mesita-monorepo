// Pay at the table, the guest's side (MESITA-3564). The guest opens a tab at
// a place and shows its QR; the waiter types the bill and a tip suggestion
// on visit.mesita.ai; the guest chooses how to pay the bill (credits first,
// the rest in cash) and the tip (cash; credits never pay a tip); a cash part
// waits for the waiter's Received. The server is the last word on every
// amount; tabSplit is only what the screen proposes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type TabStatus = "waiting_bill" | "billed" | "paying" | "paid" | "expired" | "cancelled";

/** What consumer-web-get-tab answers. */
export type GuestTab = {
  tab_id: string;
  place: { id: string; name: string | null };
  status: TabStatus;
  currency: string;
  bill_cents: number | null;
  /** The waiter's tip suggestion; the guest decides. */
  tip_suggested_cents: number;
  bill_version: number;
  ticket: string | null;
  waiter_name: string | null;
  /** The guest's credit here they can spend now. */
  spendable_cents: number;
  rates: { cash_back_bps: number; card_back_bps: number | null; card_available: boolean };
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  cash_due_cents: number;
  cash_received_cents: number | null;
  card_bill_cents: number;
  card_tip_cents: number;
  cashback_cents: number;
  paid_at: string | null;
  expires_at: string;
  updated_at: string;
  test_mode: boolean;
};

export type OpenedTab = {
  tab_id: string;
  outcome: "opened" | "reused";
  status: TabStatus;
  /** The waiter's link; null once the tab is billed (no QR needed). */
  qr_url: string | null;
  expires_at: string;
  test_mode: boolean;
};

/** Opens a tab at a place, or reuses this guest's open one there. While it
 *  waits for the bill, every open mints a new QR (only the newest works). */
export async function apiOpenTab(client: SupabaseClient, placeId: string): Promise<OpenedTab> {
  return await invokeEF<OpenedTab>(client, "consumer-web-open-tab", { place_id: placeId });
}

export async function apiGetTab(client: SupabaseClient, tabId: string): Promise<GuestTab> {
  const r = await invokeEF<{ tab: GuestTab }>(client, "consumer-web-get-tab", { tab_id: tabId });
  return r.tab;
}

export type TabSplit = {
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
};

/** One tap. `request_id` is one per tap; a retry after a lost answer sends
 *  the same, so it never pays twice. Refusals arrive as EFError codes:
 *  stale, insufficient, outside_limit, not_billed, paying, expired, … */
export async function apiPayTab(
  client: SupabaseClient,
  args: { tab_id: string; bill_version: number; request_id: string } & TabSplit,
): Promise<{ status: "paying" | "paid" }> {
  return await invokeEF<{ status: "paying" | "paid" }>(client, "consumer-web-pay-tab", {
    ...args,
    card_bill_cents: 0,
    card_tip_cents: 0,
  });
}

/** "cancel" closes the tab before paying; "change" undoes a cash choice
 *  before the waiter's Received and frees the credit it held. */
export async function apiCancelTab(client: SupabaseClient, tabId: string, mode: "cancel" | "change"): Promise<void> {
  await invokeEF(client, "consumer-web-cancel-tab", { tab_id: tabId, mode });
}

/** How the screen splits a bill: the guest's credit first (up to the bill)
 *  when they use it, the rest of the bill in cash, the whole tip in cash.
 *  Cashback is the place's rate on the cash bill part only, never on credit
 *  or the tip; the server may give less (its daily cap). */
export function tabSplit(args: {
  billCents: number;
  tipCents: number;
  spendableCents: number;
  useCredit: boolean;
  cashBackBps: number;
}): TabSplit & { total_cents: number; cash_due_cents: number; cashback_cents: number } {
  const bill = Math.max(0, Math.round(args.billCents));
  const tip = Math.max(0, Math.round(args.tipCents));
  const credit = args.useCredit ? Math.min(Math.max(0, args.spendableCents), bill) : 0;
  const cashBill = bill - credit;
  return {
    credit_cents: credit,
    cash_bill_cents: cashBill,
    cash_tip_cents: tip,
    total_cents: bill + tip,
    cash_due_cents: cashBill + tip,
    cashback_cents: Math.floor((cashBill * Math.max(0, args.cashBackBps)) / 10_000),
  };
}

/** What the guest reads when a tap is refused, by the server's code. */
export const TAB_REFUSAL: Record<string, string> = {
  stale: "The bill changed. Check it and pay again.",
  insufficient: "Your credit changed. Check it and pay again.",
  outside_limit: "You've paid the waiter in cash here enough times today. Use your credit instead.",
  not_billed: "The waiter hasn't sent the bill yet.",
  paying: "You're already paying this bill.",
  paid: "This bill is paid.",
  expired: "This bill expired. Open a new one.",
  cancelled: "This bill was cancelled.",
  card_unavailable: "Paying by card here is coming soon.",
  closed: "That payment was cancelled. Tap again to start over.",
  parts: "The amounts don't add up to the bill. Check it and pay again.",
};
