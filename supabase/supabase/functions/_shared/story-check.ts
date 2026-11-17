// The Story check (MESITA-4297): the waiter approves the guest's story
// BEFORE the guest pays. One check per guest, place and payments mode
// (story_checks); its token is the Story QR (visit.mesita.ai/story/<token>).
//
//   open      waiting for a story, or for the waiter (24 hours)
//   approved  the waiter approved one story: the guest can buy the Story
//             voucher for `approve_valid_sec` (2 hours)
//   used      a paid Story voucher took it
//   expired   past its time (or the payments mode flipped)
//
// The story the guest and the waiter see before approval is the newest story
// of the guest's verified handle nobody paid with and no live check of
// someone else holds; its status is received, or too_old past
// `max_story_age_sec`. After approval it is the one the check claimed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { storyUrl } from "./proof.ts";
import {
  MENTION_COLUMNS,
  type MentionRow,
  type MentionView,
  mentionView,
  readStoryRules,
  STORY_RULES,
  type StoryRulesLive,
} from "./story-mention.ts";

export type CheckState = "open" | "approved" | "used" | "expired";
export const CHECK_STATES: readonly CheckState[] = ["open", "approved", "used", "expired"];

/** Where the guest's story stands on an open check. */
export type CheckStoryStatus = "waiting" | "received" | "too_old";
export const CHECK_STORY_STATUSES: readonly CheckStoryStatus[] = ["waiting", "received", "too_old"];

export type CheckRow = {
  id: string;
  consumer_id: string;
  place_id: string;
  token: string;
  livemode: boolean;
  state: CheckState;
  last_rejected_at: string | null;
  approved_at: string | null;
  reviewed_at: string | null;
  used_by_purchase: string | null;
  created_at: string;
  expires_at: string;
};

export const CHECK_COLUMNS =
  "id, consumer_id, place_id, token, livemode, state, last_rejected_at, approved_at, reviewed_at, used_by_purchase, created_at, expires_at";

export type CheckLimits = { approve_valid_sec: number; max_story_age_sec: number; bonus_wait_sec: number };

export type CheckView = {
  id: string;
  token: string;
  /** The Story QR the waiter scans. */
  url: string;
  state: CheckState;
  story: (MentionView & { status: CheckStoryStatus }) | null;
  /** waiting when no story arrived yet; the story's own status otherwise. */
  story_status: CheckStoryStatus;
  last_rejected_at: string | null;
  approved_at: string | null;
  /** open: 24 hours after it opened; approved: the pay-by time. */
  expires_at: string;
  limits: CheckLimits;
  test_mode: boolean;
};

export function checkLimits(rules: StoryRulesLive): CheckLimits {
  return {
    approve_valid_sec: rules.approveValidSec,
    max_story_age_sec: rules.maxStoryAgeSec,
    bonus_wait_sec: rules.bonusWaitSec,
  };
}

/** A check past its time reads expired, whatever the cron did yet. */
export function liveState(row: Pick<CheckRow, "state" | "expires_at">, nowMs: number): CheckState {
  if ((row.state === "open" || row.state === "approved") && Date.parse(row.expires_at) <= nowMs) return "expired";
  return row.state;
}

/** received, or too_old once the story is older than the waiter may approve. */
export function storyStatus(m: Pick<MentionRow, "mentioned_at"> | null, rules: Pick<StoryRulesLive, "maxStoryAgeSec">, nowMs: number): CheckStoryStatus {
  if (!m) return "waiting";
  return nowMs - Date.parse(m.mentioned_at) > rules.maxStoryAgeSec * 1000 ? "too_old" : "received";
}

/** The pure view (story-check.test.ts pins it). */
export function checkView(
  row: CheckRow,
  story: MentionRow | null,
  rules: StoryRulesLive,
  nowMs: number,
  url: (token: string) => string = storyUrl,
): CheckView {
  const state = liveState(row, nowMs);
  // An approved check's story was within the limit when the waiter approved it.
  const status = story && (state === "approved" || state === "used") ? "received" : storyStatus(story, rules, nowMs);
  return {
    id: row.id,
    token: row.token,
    url: url(row.token),
    state,
    story: story ? { ...mentionView(story), status } : null,
    story_status: status,
    last_rejected_at: row.last_rejected_at,
    approved_at: state === "open" ? null : row.approved_at,
    expires_at: row.expires_at,
    limits: checkLimits(rules),
    test_mode: !row.livemode,
  };
}

/** The story a check shows: the one it claimed, else the newest story of the
 *  handle nobody paid with, free or held only by this guest's own expired
 *  check (one waiter scan re-approves it), a test story only on a test check. */
export async function readCheckStory(
  admin: SupabaseClient,
  row: Pick<CheckRow, "id" | "consumer_id" | "livemode" | "state">,
  handle: string | null,
  nowMs: number,
): Promise<MentionRow | null> {
  const { data: claimed, error: cErr } = await admin.from("story_mentions").select(MENTION_COLUMNS).eq("check_id", row.id).maybeSingle();
  if (cErr) throw new Error(`story_mentions: ${cErr.message}`);
  if (claimed) return claimed as MentionRow;
  if (row.state !== "open" || !handle) return null;
  const since = new Date(nowMs - STORY_RULES.mentionLifeSec * 1000).toISOString();
  const { data, error } = await admin.from("story_mentions").select(MENTION_COLUMNS)
    .eq("ig_handle", handle.toLowerCase()).is("purchase_id", null).gte("mentioned_at", since)
    .order("mentioned_at", { ascending: false }).limit(20);
  if (error) throw new Error(`story_mentions: ${error.message}`);
  const rows = ((data ?? []) as MentionRow[]).filter((m) => m.livemode || !row.livemode);
  const held = [...new Set(rows.map((m) => m.check_id).filter((id): id is string => !!id))];
  let mineExpired = new Set<string>();
  if (held.length > 0) {
    const { data: hc, error: hErr } = await admin.from("story_checks").select("id")
      .in("id", held).eq("consumer_id", row.consumer_id).eq("state", "expired").is("used_by_purchase", null);
    if (hErr) throw new Error(`story_checks: ${hErr.message}`);
    mineExpired = new Set(((hc ?? []) as Array<{ id: string }>).map((c) => c.id));
  }
  return rows.find((m) => !m.check_id || mineExpired.has(m.check_id)) ?? null;
}

/** The guest's open/approved check at a place in this payments mode, or null. */
export async function readGuestCheck(
  admin: SupabaseClient,
  consumerId: string,
  placeId: string,
  livemode: boolean,
): Promise<CheckRow | null> {
  const { data, error } = await admin.from("story_checks").select(CHECK_COLUMNS)
    .eq("consumer_id", consumerId).eq("place_id", placeId).eq("livemode", livemode)
    .in("state", ["open", "approved"]).maybeSingle();
  if (error) throw new Error(`story_checks: ${error.message}`);
  return (data as CheckRow | null) ?? null;
}

export async function readCheckByToken(admin: SupabaseClient, token: string): Promise<CheckRow | null> {
  const { data, error } = await admin.from("story_checks").select(CHECK_COLUMNS).eq("token", token).maybeSingle();
  if (error) throw new Error(`story_checks: ${error.message}`);
  return (data as CheckRow | null) ?? null;
}

/** Mint or return the guest's check (wallet_open_story_check). */
export async function openGuestCheck(admin: SupabaseClient, consumerId: string, placeId: string, livemode: boolean): Promise<CheckRow> {
  const { data, error } = await admin.rpc("wallet_open_story_check", { p_consumer: consumerId, p_place: placeId, p_livemode: livemode });
  if (error) throw new Error(`wallet_open_story_check: ${error.message}`);
  const r = data as { ok?: boolean; code?: string; check?: CheckRow } | null;
  if (!r?.ok || !r.check) throw new Error(`wallet_open_story_check: ${r?.code ?? "no_check"}`);
  return r.check;
}

/** The view with its story and the live rules. */
export async function viewCheck(admin: SupabaseClient, row: CheckRow, handle: string | null, nowMs = Date.now()): Promise<CheckView> {
  const [story, rules] = await Promise.all([readCheckStory(admin, row, handle, nowMs), readStoryRules(admin)]);
  return checkView(row, story, rules, nowMs);
}

// ── The buy door ─────────────────────────────────────────────────────────────

export type BuyGateReason = "no_check" | "expired" | "used" | "mode_mismatch";

/** Why a Story buy is refused, or the check to present. `presented` counts
 *  other purchases not failed or expired that already present this check. */
export function storyBuyGate(
  check: Pick<CheckRow, "id" | "state" | "expires_at" | "livemode"> | null,
  livemode: boolean,
  presented: number,
  nowMs: number,
): { ok: true; checkId: string } | { ok: false; reason: BuyGateReason; check_state: CheckState | null; expires_at: string | null } {
  if (!check) return { ok: false, reason: "no_check", check_state: null, expires_at: null };
  const state = liveState(check, nowMs);
  const out = { check_state: state, expires_at: check.expires_at };
  if (check.livemode !== livemode) return { ok: false, reason: "mode_mismatch", ...out };
  if (state === "used" || presented > 0) return { ok: false, reason: "used", ...out };
  if (state !== "approved") return { ok: false, reason: state === "expired" ? "expired" : "no_check", ...out };
  return { ok: true, checkId: check.id };
}

/** The buy door's read: the guest's approved check here and how many live
 *  purchases already present it. */
export async function readStoryBuyGate(
  admin: SupabaseClient,
  consumerId: string,
  placeId: string,
  livemode: boolean,
  nowMs = Date.now(),
): Promise<ReturnType<typeof storyBuyGate>> {
  const check = await readGuestCheck(admin, consumerId, placeId, livemode);
  let presented = 0;
  if (check) {
    const { count, error } = await admin.from("wallet_purchases").select("id", { count: "exact", head: true })
      .eq("story_check_id", check.id).not("status", "in", "(failed,expired)");
    if (error) throw new Error(`wallet_purchases: ${error.message}`);
    presented = count ?? 0;
  }
  return storyBuyGate(check, livemode, presented, nowMs);
}

/** The 409 the buy door answers. */
export function storyNotVerified(g: Exclude<ReturnType<typeof storyBuyGate>, { ok: true }>) {
  return {
    ok: false as const,
    code: "story_not_verified",
    reason: g.reason,
    check_state: g.check_state,
    expires_at: g.expires_at,
    error: g.reason === "used"
      ? "This story was already used for a Story voucher. Post a new story for another."
      : "Your story approval expired. Get it approved again to buy the Story voucher.",
  };
}

// ── The guest's door (consumer-web-open-story-check, -get-story-check) ───────

export type GuestCheckRefusal = { status: number; code: string; error: string; min_followers?: number; followers?: number };

/** Why this guest cannot use Story here, or null. */
export function guestCheckRefusal(
  mode: "meta" | "emulated" | "unavailable",
  guest: { instagram_handle: string | null; instagram_followers_count: number | null } | null,
  minFollowers: number,
): GuestCheckRefusal | null {
  if (mode === "unavailable") return { status: 409, code: "story_unavailable", error: "Story isn't available here right now" };
  if (!guest?.instagram_handle) return { status: 403, code: "needs_instagram", error: "Connect your Instagram to use Story" };
  const followers = guest.instagram_followers_count ?? 0;
  if (followers <= minFollowers) {
    return {
      status: 403,
      code: "few_followers",
      error: `Story needs more than ${minFollowers.toLocaleString("en-US")} followers`,
      min_followers: minFollowers,
      followers,
    };
  }
  return null;
}
