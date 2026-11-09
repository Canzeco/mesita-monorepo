// The Story voucher's activation (MESITA-3507). A paid Story holds no credit
// until staff see the guest's Instagram story at the place: the guest's
// Wallet shows a QR to visit.mesita.ai/story/<token>, staff read it
// (visit-web-get-story) and tap Activate (visit-web-activate-story →
// wallet_activate_story, which writes the voucher and bonus, Available now).
//
// No sign-in on the staff page: the 122-bit token is the key, as the payment
// proof's is (MESITA-3304). Unlike the proof, the page names the guest's
// Instagram handle: staff must match the story to the account that bought it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readInstagramSyncState } from "./consumer-doc.ts";
import { readVoucherPlace } from "./wallet.ts";

/** 32 lowercase hex: `gen_random_uuid()` without its dashes. */
export function isStoryToken(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

export type StoryRow = {
  id: string;
  status: string;
  amount_cents: number;
  bonus_cents: number;
  currency: string;
  livemode: boolean;
  paid_at: string | null;
  story_activated_at: string | null;
  place_id: string;
  consumer_id: string | null;
};

export type StoryView = {
  place: { name: string | null };
  instagram_handle: string | null;
  amount_cents: number;
  credit_cents: number;
  currency: string;
  paid_at: string | null;
  activated_at: string | null;
  /** A Story refunded before activation can no longer be activated. */
  refunded: boolean;
  test_mode: boolean;
};

export function storyView(row: StoryRow, placeName: string | null, handle: string | null): StoryView {
  return {
    place: { name: placeName },
    instagram_handle: handle,
    amount_cents: row.amount_cents,
    credit_cents: row.amount_cents + row.bonus_cents,
    currency: row.currency,
    paid_at: row.paid_at,
    activated_at: row.story_activated_at,
    refunded: row.status !== "paid" && row.story_activated_at === null,
    test_mode: !row.livemode,
  };
}

/** The Story behind a token, with its place's name and the buyer's handle;
 *  row null when no paid (or since refunded) Story carries it. */
export async function readStory(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; row: StoryRow | null; placeName: string | null; handle: string | null } | { ok: false; error: string }> {
  const { data, error } = await admin.from("wallet_purchases")
    .select("id, status, amount_cents, bonus_cents, currency, livemode, paid_at, story_activated_at, place_id, consumer_id")
    .eq("story_token", token).eq("voucher", "voucher_story")
    .in("status", ["paid", "refunded", "partly_refunded", "needs_review"])
    .maybeSingle();
  if (error) return { ok: false, error: `wallet_purchases: ${error.message}` };
  const row = data as StoryRow | null;
  if (!row) return { ok: true, row: null, placeName: null, handle: null };
  const [place, guest] = await Promise.all([
    readVoucherPlace(admin, row.place_id),
    row.consumer_id ? readInstagramSyncState(admin, row.consumer_id) : Promise.resolve(null),
  ]);
  if (!place.ok) return { ok: false, error: place.error };
  if (guest && !guest.ok) return { ok: false, error: `consumers: ${guest.error}` };
  return {
    ok: true,
    row,
    placeName: place.place?.name ?? null,
    handle: guest && guest.ok ? guest.handle : null,
  };
}
