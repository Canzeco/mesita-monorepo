// House Cards a guest pinned by hand (MESITA-3582).
//
// A House Card is a place's card in the guest's Wallet. It appears on its
// own once the guest holds entries there (wallet_entries); a guest can also
// pin it with $0 from the place screen ("Add card to Wallet"). A pin is a
// Wallet preference, not money: wallet_house_cards, EF-only.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Balance } from "./wallet.ts";

export type Pin = { place_id: string; added_at: string };

/** The guest's pins, newest first. */
export async function readPins(
  admin: SupabaseClient,
  consumerId: string,
): Promise<{ ok: true; pins: Pin[] } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("wallet_house_cards")
    .select("place_id, added_at")
    .eq("consumer_id", consumerId)
    .order("added_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: `house_cards: ${error.message}` };
  return { ok: true, pins: (data ?? []) as Pin[] };
}

/** A pinned place with no entries reads as a $0 card, after the cards that
 *  hold money; a place that already has a balance is never added twice. */
export function withPins(balances: Balance[], pins: Pin[], currency: string): Array<Balance & { pinned: boolean }> {
  const pinned = new Set(pins.map((p) => p.place_id));
  const held = new Set(balances.map((b) => b.place_id));
  const out: Array<Balance & { pinned: boolean }> = balances.map((b) => ({ ...b, pinned: pinned.has(b.place_id) }));
  for (const p of pins) {
    if (held.has(p.place_id)) continue;
    held.add(p.place_id);
    out.push({
      place_id: p.place_id,
      currency,
      balance_cents: 0,
      available_cents: 0,
      pending_cents: 0,
      spendable_cents: 0,
      last_at: p.added_at,
      entries: [],
      pinned: true,
    });
  }
  return out;
}

/** Whether this place's card is in the guest's Wallet: pinned, or holding
 *  any entry there in this universe. */
export async function inWallet(
  admin: SupabaseClient,
  consumerId: string,
  placeId: string,
  livemode: boolean,
): Promise<{ ok: true; in_wallet: boolean } | { ok: false; error: string }> {
  const [pin, entry] = await Promise.all([
    admin.from("wallet_house_cards").select("place_id").eq("consumer_id", consumerId).eq("place_id", placeId).maybeSingle(),
    admin.from("wallet_entries").select("id").eq("consumer_id", consumerId).eq("place_id", placeId).eq("livemode", livemode).limit(1),
  ]);
  if (pin.error) return { ok: false, error: `house_cards: ${pin.error.message}` };
  if (entry.error) return { ok: false, error: `entries: ${entry.error.message}` };
  return { ok: true, in_wallet: !!pin.data || (entry.data ?? []).length > 0 };
}

/** The guest's money at a place in this universe, every entry summed (Pending
 *  included). A pin on a place where this is not zero cannot be removed. */
export async function balanceAt(
  admin: SupabaseClient,
  consumerId: string,
  placeId: string,
  livemode: boolean,
): Promise<{ ok: true; cents: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("wallet_entries")
    .select("amount_cents")
    .eq("consumer_id", consumerId)
    .eq("place_id", placeId)
    .eq("livemode", livemode)
    .limit(5000);
  if (error) return { ok: false, error: `entries: ${error.message}` };
  return { ok: true, cents: ((data ?? []) as Array<{ amount_cents: number }>).reduce((s, r) => s + r.amount_cents, 0) };
}
