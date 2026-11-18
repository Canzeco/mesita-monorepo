// The waiter's step of the Story voucher (MESITA-4304, on top of MESITA-4296's
// app check; the pieces come from the closed MESITA-4297).
//
// The guest's check finds their story and points it at the place
// (story_review_open, which mints a QR token); the Story page shows the QR
// to visit.mesita.ai/story/<token>; the waiter reads the story there
// (visit-web-get-story) and approves or rejects it with the place's waiter
// code (visit-web-review-story). Only an approved story is payable.
//
// The guest holds the QR, so the token alone never approves anything: the
// phone must carry a current `s2` waiter-code staff token of the STORY's
// place (_shared/staff.ts, the tab Verify's rule). Without one the answer is
// 403 staff_code_needed; a waiter of another place gets 403 wrong_place.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { PROOF_ORIGIN } from "./proof.ts";
import type { StaffTokenInfo } from "./staff.ts";
import { mentionFits, STORY_RULES, type StoryRulesLive } from "./story-mention.ts";

/** How the guest's page looks while it waits for the waiter: every 5 s for
 *  10 minutes (the 2-minute story look is too short for a busy waiter). */
export const REVIEW_POLL = { every_ms: STORY_RULES.pollEveryMs, for_ms: 10 * 60_000 } as const;

export function isReviewToken(t: unknown): t is string {
  return typeof t === "string" && /^[0-9a-f]{32}$/.test(t);
}

export function storyReviewUrl(token: string): string {
  return `${PROOF_ORIGIN}/story/${token}`;
}

export type StoryReviewAnswer = { state: "waiting" | "approved"; url: string | null; reviewed_at: string | null };

/** The guest's side: point the found story at this place and answer where
 *  the waiter stands. A rejected story never reaches here (storyCheck skips
 *  it); should a race land one, it reads waiting (Pay stays off). */
export async function openStoryReview(admin: SupabaseClient, mentionId: string, placeId: string): Promise<StoryReviewAnswer> {
  const { data, error } = await admin.rpc("story_review_open", { p_mention: mentionId, p_place: placeId });
  if (error) throw new Error(`story_review_open: ${error.message}`);
  const r = (data ?? {}) as { ok?: boolean; token?: string; place_id?: string | null; review?: string | null; reviewed_at?: string | null };
  if (!r.ok || !r.token) return { state: "waiting", url: null, reviewed_at: null };
  const approved = r.review === "approved" && r.place_id === placeId;
  return { state: approved ? "approved" : "waiting", url: storyReviewUrl(r.token), reviewed_at: approved ? r.reviewed_at ?? null : null };
}

// ── The waiter's read ───────────────────────────────────────────────────────

export type WaiterStoryRow = {
  id: string;
  ig_handle: string | null;
  purchase_id: string | null;
  media_url: string | null;
  media_kind: "image" | "video";
  source: "meta" | "emulator";
  mentioned_at: string;
  livemode: boolean;
  review: "approved" | "rejected" | null;
  review_place_id: string | null;
  reviewed_at: string | null;
};

export const WAITER_STORY_COLUMNS =
  "id, ig_handle, purchase_id, media_url, media_kind, source, mentioned_at, livemode, review, review_place_id, reviewed_at";

/** Where the story stands for the waiter:
 *   waiting   approve or reject it (status received), or it is too old to
 *             approve (status too_old)
 *   approved  the guest can pay
 *   rejected  it never counts; the guest posts another
 *   used      a Story purchase claimed it */
export type WaiterState = "waiting" | "approved" | "rejected" | "used";

export function waiterState(row: Pick<WaiterStoryRow, "purchase_id" | "review">): WaiterState {
  if (row.purchase_id) return "used";
  if (row.review === "approved") return "approved";
  if (row.review === "rejected") return "rejected";
  return "waiting";
}

/** The page's view of one story. `nowMs` and `rules` decide too_old: an
 *  approval needs the story to outlive the re-check (the DB re-checks). */
export function waiterStoryView(
  row: WaiterStoryRow,
  place: { id: string; name: string | null; instagram_handle: string | null },
  testMode: boolean,
  nowMs: number,
  rules: Pick<StoryRulesLive, "bonusWaitSec" | "checkMarginSec">,
) {
  const fits = mentionFits(row, row.livemode, nowMs, rules, rules.checkMarginSec);
  return {
    mention_id: row.id,
    place,
    instagram_handle: row.ig_handle,
    state: waiterState(row),
    story: {
      id: row.id,
      media_url: row.media_url,
      media_kind: row.media_kind,
      mentioned_at: row.mentioned_at,
      source: row.source,
      status: fits ? "received" : "too_old",
    },
    reviewed_at: row.reviewed_at,
    bonus_wait_sec: rules.bonusWaitSec,
    test_mode: testMode,
    server_time: new Date(nowMs).toISOString(),
  };
}

// ── The waiter's decision ───────────────────────────────────────────────────

export type ReviewBody = {
  token: string;
  decision: "approve" | "reject";
  staffToken: string | null;
  placeId: string | null;
};

export type ReviewRefusal = { ok: false; status: number; code: string; error: string };

const refuse = (status: number, code: string, error: string): ReviewRefusal => ({ ok: false, status, code, error });

/** The body, or the refusal. */
export function readReviewBody(b: Record<string, unknown>): { ok: true; body: ReviewBody } | ReviewRefusal {
  if (!isReviewToken(b.token)) return refuse(400, "bad_request", "That is not a Story QR");
  if (b.decision !== "approve" && b.decision !== "reject") return refuse(400, "bad_request", "decision must be approve or reject");
  if (b.place_id !== undefined && b.place_id !== null && !isUuid(b.place_id)) {
    return refuse(400, "bad_request", "place_id must be a Mesita place id");
  }
  const staffToken = typeof b.staff_token === "string" && b.staff_token.length <= 128 ? b.staff_token : null;
  return {
    ok: true,
    body: { token: b.token, decision: b.decision, staffToken, placeId: (b.place_id as string | null | undefined) ?? null },
  };
}

/** The staff gate: a current s2 token (a device id) for the story's place.
 *  `info` is readStaffToken's answer against that place's keys, so another
 *  place's token never verifies. */
export function staffGate(
  body: Pick<ReviewBody, "staffToken" | "placeId">,
  storyPlaceId: string,
  info: StaffTokenInfo | null,
): { ok: true; jti: string } | ReviewRefusal {
  if (body.placeId && body.placeId !== storyPlaceId) return refuse(403, "wrong_place", "This story is for another place.");
  if (!body.staffToken || !info || info.version !== 2 || !info.jti) return refuse(403, "staff_code_needed", "Type the waiter code");
  return { ok: true, jti: info.jti };
}

/** story_review's refusal codes → HTTP. */
const RPC_REFUSAL: Record<string, { status: number; error: string }> = {
  gone: { status: 404, error: "This Story QR is not valid any more. Ask the guest to show it again." },
  wrong_place: { status: 403, error: "This story is for another place." },
  already_decided: { status: 409, error: "This story was already decided" },
  story_claimed: { status: 409, error: "This story was already used for a Story voucher" },
  story_too_old: { status: 409, error: "This story is too old for the bonus. Ask the guest to post a new one." },
};

export function reviewRefusal(code: string | undefined): ReviewRefusal {
  const r = code ? RPC_REFUSAL[code] : undefined;
  return r ? refuse(r.status, code!, r.error) : refuse(500, "server", "Couldn't save. Try again");
}

/** The codes the RPC answers (story-review.test.ts pins the map covers them). */
export const REVIEW_CODES = Object.keys(RPC_REFUSAL);
