// The Story screen's one read (MESITA-4405), shared by consumer-web-get-story
// (read only) and consumer-web-check-story (bind first, then read): the
// Story, its purchase, the story it holds, the place's Instagram and time
// zone, and whether the test-mode buttons show.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { APPROVED_SLOW_POLL, readOwnStory, readStoryMentions, readStoryPurchases, STORY_POLL, type StoryRecord, storyView, type StoryView } from "./story.ts";
import { readStoryRules, storyMode } from "./story-mention.ts";
import { readVoucherPlace } from "./wallet.ts";
import { instagramHandleOfUrl } from "./place-instagram.ts";
import { placeZone, PLACE_ZONE_COLUMNS } from "./local-time.ts";
import { paymentsLivemode } from "./stripe.ts";
import { readInstagramSyncState } from "./consumer-doc.ts";

export async function readStoryScreen(admin: SupabaseClient, s: StoryRecord, nowMs: number): Promise<StoryView & { place_name: string | null }> {
  const [purchases, mentions, placeRes, zone, rules] = await Promise.all([
    readStoryPurchases(admin, [s.purchase_id]),
    readStoryMentions(admin, [s.mention_id]),
    s.place_id ? readVoucherPlace(admin, s.place_id) : Promise.resolve({ ok: true as const, place: null }),
    s.place_id
      ? admin.from("place_profiles").select(`id, ${PLACE_ZONE_COLUMNS}`).eq("id", s.place_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    readStoryRules(admin),
  ]);
  if (!placeRes.ok) throw new Error(placeRes.error);
  const place = placeRes.place;
  const view = storyView(s, {
    purchase: s.purchase_id ? purchases.get(s.purchase_id) ?? null : null,
    mention: s.mention_id ? mentions.get(s.mention_id) ?? null : null,
    placeHandle: instagramHandleOfUrl(place?.instagram_url ?? null),
    timeZone: placeZone((zone.error ? null : zone.data) as { timezone?: unknown; lng?: unknown } | null),
    // MESITA-4527: the test buttons show only while Admin's switch is on.
    emulator: !paymentsLivemode() && storyMode() === "emulated" && rules.emulator,
    nowMs,
  });
  return { ...view, place_name: place?.name ?? null };
}

/** The voucher ticket, before any story is detected (MESITA-4484). A void
 *  story is skipped so the guest can post another without buying again. */
export async function readVoucherStoryScreen(
  admin: SupabaseClient,
  consumerId: string,
  purchaseId: string,
  nowMs: number,
): Promise<(StoryView & { place_name: string | null; ai_check?: StoryCheck | null }) | null> {
  const existing = await readOwnStory(admin, consumerId, { purchaseId });
  if (existing) return readStoryScreen(admin, existing, nowMs);
  const { data, error } = await admin.from("wallet_purchases")
    .select("id, consumer_id, place_id, amount_cents, bonus_cents, currency, paid_at, status, livemode, voucher")
    .eq("id", purchaseId).eq("consumer_id", consumerId).maybeSingle();
  if (error) throw new Error(`wallet_purchases: ${error.message}`);
  const p = data as {
    id: string; consumer_id: string; place_id: string; amount_cents: number; bonus_cents: number;
    currency: string; paid_at: string | null; status: string; livemode: boolean; voucher: string;
  } | null;
  if (!p || p.voucher !== "voucher_story" || p.status !== "paid") return null;
  const synthetic: StoryRecord = {
    id: "",
    purchase_id: p.id,
    consumer_id: p.consumer_id,
    place_id: p.place_id,
    livemode: p.livemode,
    state: "waiting_post",
    deadline_at: new Date(nowMs + 365 * 24 * 60 * 60 * 1000).toISOString(),
    mention_id: null,
    first_bound_at: null,
    approved_at: null,
    recheck_at: null,
    recheck_tries: 0,
    wait_sec: null,
    decided_at: null,
    void_reason: null,
    bonus_cents: p.bonus_cents,
    created_at: p.paid_at ?? new Date(nowMs).toISOString(),
  };
  const [view, check] = await Promise.all([
    readStoryScreen(admin, synthetic, nowMs),
    readStoryCheck(admin, consumerId, p.livemode, p.paid_at),
  ]);
  return { ...view, story_id: "", poll: check?.state === "checking_long" ? APPROVED_SLOW_POLL : STORY_POLL, ai_check: check };
}

/** What the bot says about the guest's newest story since this voucher was
 *  paid, while no story holds the voucher (MESITA-4549): checking (not read
 *  yet), checking_long (the desk has it), or rejected with its reason. Null
 *  when the guest has posted nothing since. A rejected story matched no
 *  place, so this reads by guest, not by place. */
export type StoryCheck = { state: "checking" | "checking_long" | "rejected"; reason: string | null; mentioned_at: string };

export async function readStoryCheck(
  admin: SupabaseClient,
  consumerId: string,
  livemode: boolean,
  sinceIso: string | null,
): Promise<StoryCheck | null> {
  const guest = await readInstagramSyncState(admin, consumerId);
  const handle = guest.ok ? guest.handle?.toLowerCase() : null;
  if (!handle) return null;
  let q = admin.from("story_mentions")
    .select("id, mentioned_at, ai_checked_at, ai_outcome, ai_reason, deleted_at")
    .eq("ig_handle", handle).eq("livemode", livemode).is("deleted_at", null)
    .order("mentioned_at", { ascending: false }).limit(1);
  if (sinceIso) q = q.gte("mentioned_at", sinceIso);
  const { data, error } = await q;
  if (error) {
    console.error("[story-screen] check_read", JSON.stringify({ error: error.message }));
    return null;
  }
  const m = (data ?? [])[0] as { mentioned_at: string; ai_checked_at: string | null; ai_outcome: string | null; ai_reason: string | null } | undefined;
  if (!m) return null;
  if (!m.ai_checked_at) return { state: "checking", reason: null, mentioned_at: m.mentioned_at };
  if (m.ai_outcome === "ambiguous" || m.ai_outcome === "unreadable") return { state: "checking_long", reason: null, mentioned_at: m.mentioned_at };
  if (m.ai_outcome === "rejected") return { state: "rejected", reason: m.ai_reason, mentioned_at: m.mentioned_at };
  return null;
}
