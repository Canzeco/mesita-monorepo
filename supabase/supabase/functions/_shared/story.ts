// The Story voucher (MESITA-3507; verified from the @mesita mention since
// MESITA-4264; verified BEFORE payment since MESITA-4297).
//
//   1. the guest posts a story tagging @mesita and the place;
//   2. the Offers sheet shows the guest's Story QR, visit.mesita.ai/story/<check
//      token> (_shared/story-check.ts); the waiter reads it here
//      (visit-web-get-story: the guest's handle and the story) and, signed in
//      with the waiter code, approves or rejects (visit-web-review-story);
//   3. an approved check lets the guest buy the Story voucher (2 hours);
//   4. what they paid is Available at payment;
//   5. 3 hours after payment supabase-cron-recheck-stories fetches the story
//      again and releases the bonus if it still loads.
//
// Reading needs no sign-in: the 122-bit token is the key, as the payment
// proof's is (MESITA-3304). Approving needs a current waiter-code staff token
// of the check's place: the guest holds the QR.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readInstagramSyncState } from "./consumer-doc.ts";
import { placeZone, PLACE_ZONE_COLUMNS } from "./local-time.ts";
import { readStoryRules, STORY_RULES, type StoryRulesLive } from "./story-mention.ts";
import { type CheckRow, type CheckView, checkView, readCheckByToken, readCheckStory } from "./story-check.ts";

/** 32 lowercase hex: `gen_random_uuid()` without its dashes. */
export function isStoryToken(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

// ── A paid Story's bonus (the Wallet row) ────────────────────────────────────

export type StoryVoidReason = "unreachable" | "expired" | "refunded" | "operator" | "not_verified";

export type StoryRow = {
  id: string;
  status: string;
  amount_cents: number;
  bonus_cents: number;
  currency: string;
  livemode: boolean;
  paid_at: string | null;
  /** When the waiter approved the story the purchase used. */
  story_activated_at: string | null;
  story_review?: "approved" | "rejected" | null;
  story_reviewed_at?: string | null;
  story_recheck_at?: string | null;
  story_bonus?: "released" | "void" | null;
  story_bonus_void_reason?: StoryVoidReason | null;
  story_bonus_decided_at?: string | null;
  story_check_id?: string | null;
  place_id: string;
  consumer_id: string | null;
};

export const STORY_COLUMNS =
  "id, status, amount_cents, bonus_cents, currency, livemode, paid_at, story_activated_at, story_review, story_reviewed_at, story_recheck_at, story_bonus, story_bonus_void_reason, story_bonus_decided_at, story_check_id, place_id, consumer_id";

/** Where a bought Story's bonus stands (story.test.ts pins it): processing
 *  until the payment credits, then waiting for the 3-hour re-check, then
 *  released or void. Every state before payment lives on the check. */
export type StoryState = "processing" | "approved" | "released" | "void";

export function storyState(row: Pick<StoryRow, "status" | "story_review" | "story_bonus">): StoryState {
  if (row.story_bonus === "released") return "released";
  if (row.story_bonus === "void") return "void";
  if (row.status === "open" || row.status === "opening") return "processing";
  return row.story_review === "approved" ? "approved" : "void";
}

/** When the bonus lands if the story is still up: the re-check time. */
export function storyBonusAt(row: Pick<StoryRow, "story_recheck_at">): string | null {
  return row.story_recheck_at ?? null;
}

// ── The waiter's page ────────────────────────────────────────────────────────

import { instagramHandleOfUrl } from "./place-instagram.ts";
export { instagramHandleOfUrl };

export type StoryPlace = { id: string; name: string | null; instagram_handle: string | null; time_zone: string };

export type StaffStoryView = CheckView & {
  check_id: string;
  place: StoryPlace;
  /** The guest's verified Instagram handle: the waiter matches the story to it. */
  instagram_handle: string | null;
};

export function staffStoryView(view: CheckView, place: StoryPlace, handle: string | null): StaffStoryView {
  return { ...view, check_id: view.id, place, instagram_handle: handle };
}

/** The check behind a QR token with everything the waiter's page shows;
 *  `retired` when the token is an old purchase-level Story token. */
export async function readStaffStory(
  admin: SupabaseClient,
  token: string,
  nowMs: number = Date.now(),
): Promise<
  | { ok: true; kind: "none" | "retired" }
  | { ok: true; kind: "check"; row: CheckRow; view: StaffStoryView; rules: StoryRulesLive }
  | { ok: false; error: string }
> {
  let row: CheckRow | null;
  try {
    row = await readCheckByToken(admin, token);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!row) {
    const { data, error } = await admin.from("wallet_purchases").select("id").eq("story_token", token).maybeSingle();
    if (error) return { ok: false, error: `wallet_purchases: ${error.message}` };
    return { ok: true, kind: data ? "retired" : "none" };
  }
  const [placeRes, guest, rules] = await Promise.all([
    admin.from("place_profiles").select(`id, name, instagram_url, ${PLACE_ZONE_COLUMNS}`).eq("id", row.place_id).maybeSingle(),
    readInstagramSyncState(admin, row.consumer_id),
    readStoryRules(admin),
  ]);
  if (placeRes.error) return { ok: false, error: `place_read: ${placeRes.error.message}` };
  if (!guest.ok) return { ok: false, error: `consumers: ${guest.error}` };
  const handle = guest.handle?.toLowerCase() ?? null;
  let story;
  try {
    story = await readCheckStory(admin, row, handle, nowMs);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const p = placeRes.data as { id: string; name: string | null; instagram_url: string | null; timezone?: unknown; lng?: unknown } | null;
  const place: StoryPlace = {
    id: row.place_id,
    name: p?.name ?? null,
    instagram_handle: instagramHandleOfUrl(p?.instagram_url),
    time_zone: placeZone(p),
  };
  return { ok: true, kind: "check", row, rules, view: staffStoryView(checkView(row, story, rules, nowMs), place, handle) };
}

export const STAFF_POLL = { every_ms: STORY_RULES.staffPollEveryMs, for_ms: STORY_RULES.staffPollForMs };
