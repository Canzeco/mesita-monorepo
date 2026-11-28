// GUESTS WHO CAME BACK (Pato, 2026-11-27, MESITA-5069): the owner has to see
// cashback working, or they switch it off. Over the last 30 days: how many
// guests paid a bill here with credit after this place had given them
// cashback, and what those bills came to (credit + cash + card, never the
// tip). Read-only; nothing here moves money.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const CAME_BACK_DAYS = 30;

export type CameBack = { guests: number; spent_cents: number; days: number };

type Tab = { consumer_id: string | null; paid_at: string | null; credit_cents: number | null; cash_bill_cents: number | null; card_bill_cents: number | null };
type Earned = { consumer_id: string; created_at: string };

/** Pure: a bill counts when its guest earned cashback here before it was paid. */
export function countCameBack(tabs: Tab[], earned: Earned[], days = CAME_BACK_DAYS): CameBack {
  const first = new Map<string, string>();
  for (const e of earned) {
    const was = first.get(e.consumer_id);
    if (!was || e.created_at < was) first.set(e.consumer_id, e.created_at);
  }
  const guests = new Set<string>();
  let spent = 0;
  for (const t of tabs) {
    if (!t.consumer_id || !t.paid_at || (t.credit_cents ?? 0) <= 0) continue;
    const earnedAt = first.get(t.consumer_id);
    if (!earnedAt || earnedAt >= t.paid_at) continue;
    guests.add(t.consumer_id);
    spent += (t.credit_cents ?? 0) + (t.cash_bill_cents ?? 0) + (t.card_bill_cents ?? 0);
  }
  return { guests: guests.size, spent_cents: spent, days };
}

export async function readCameBack(admin: SupabaseClient, placeId: string, livemode: boolean, now = Date.now()): Promise<CameBack> {
  const since = new Date(now - CAME_BACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: tabs, error: tabErr } = await admin.from("pay_tabs")
    .select("consumer_id, paid_at, credit_cents, cash_bill_cents, card_bill_cents")
    .eq("place_id", placeId)
    .eq("status", "paid")
    .eq("livemode", livemode)
    .gt("credit_cents", 0)
    .gte("paid_at", since)
    .limit(5000);
  if (tabErr) throw new Error(`pay_tabs: ${tabErr.message}`);
  const rows = (tabs ?? []) as Tab[];
  const ids = [...new Set(rows.map((t) => t.consumer_id).filter((x): x is string => !!x))];
  if (ids.length === 0) return { guests: 0, spent_cents: 0, days: CAME_BACK_DAYS };
  const { data: earned, error: eErr } = await admin.from("wallet_entries")
    .select("consumer_id, created_at")
    .eq("place_id", placeId)
    .eq("kind", "cashback")
    .eq("livemode", livemode)
    .in("consumer_id", ids)
    .limit(5000);
  if (eErr) throw new Error(`wallet_entries: ${eErr.message}`);
  return countCameBack(rows, (earned ?? []) as Earned[]);
}
