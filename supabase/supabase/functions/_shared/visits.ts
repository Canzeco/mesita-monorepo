// What a visit is (MESITA-3463, decided at the /autoplan gate of 2026-11-08):
// a guest's payment at a place that reached paid with a card part above
// zero. A card charge on the place's own Stripe account is the proof of
// presence; "Mark as seen" on visit.mesita.ai stays a backstop for disputes
// and amount checks and never counts.
//
//   counts        card_cents > 0 and the row reached paid (paid,
//                 partly_refunded, refunded, needs_review: a later refund
//                 never takes a visit back)
//   never counts  a credit-only payment (card_cents = 0), a bill paid
//                 outside and confirmed by the waiter (card_cents = 0, the
//                 outside part is outside_cents), a tip alone (tip_cents is
//                 apart from card_cents, and start-payment refuses a tip
//                 with no card part), an open, failed or expired row
//
// Readers: the Story and VIP vouchers, one each new visit (vouchers.ts,
// perVisitUsed). Welcome has its own gate (readWelcomeUsed: once per place,
// any visit, MESITA-3854).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** The statuses of a row that reached paid. Mirrors the paid_at CHECK on
 *  wallet_payments (20261107050000_w1a_ledger_on_connect). */
export const VISIT_STATUSES = ["paid", "partly_refunded", "refunded", "needs_review"] as const;

export type VisitRow = { status: string; card_cents: number };

/** The pure rule, for a row already in hand. */
export function isVisit(row: VisitRow): boolean {
  return row.card_cents > 0 && (VISIT_STATUSES as readonly string[]).includes(row.status);
}

/** How many visits this guest has made to this place. 0 for an anonymous
 *  caller. */
export async function readVisitCount(admin: SupabaseClient, consumerId: string | null, placeId: string): Promise<number> {
  if (!consumerId) return 0;
  const { count, error } = await admin.from("wallet_payments")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId).eq("place_id", placeId)
    .gt("card_cents", 0)
    .in("status", [...VISIT_STATUSES]);
  if (error) throw new Error(`wallet_payments: ${error.message}`);
  return count ?? 0;
}

/** The vouchers sold one each new visit (Docs › Main §6). */
export const PER_VISIT_VOUCHERS = ["voucher_story", "voucher_vip"] as const;
export type PerVisitVoucher = (typeof PER_VISIT_VOUCHERS)[number];

/** One each new visit: the first may be bought before any visit (the guest
 *  is at the table, the bill not paid yet); each next one needs one more
 *  visit. So a guest may buy while their live purchases of it are no more
 *  than their visits here. */
export function perVisitSpent(bought: number, visits: number): boolean {
  return bought > visits;
}
