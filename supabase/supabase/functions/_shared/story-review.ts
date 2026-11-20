// The waiter's step of the Story (MESITA-4304; after payment since
// MESITA-4405). story_bind ties the guest's story to their Story and mints
// its QR token; the Story screen shows the QR to visit.mesita.ai/story/<token>;
// the waiter reads the story there (visit-web-get-story) and approves or
// rejects it with the place's waiter code (visit-web-review-story). An
// approval starts the bonus's re-check; a reject sends the Story back to
// waiting for a new post.
//
// The guest holds the QR, so the token alone never approves anything: the
// phone must carry a current `s2` waiter-code staff token of the STORY's
// place (_shared/staff.ts, the tab Verify's rule). Without one the answer is
// 403 staff_code_needed; a waiter of another place gets 403 wrong_place.

import { isUuid } from "./place-id.ts";
import { PROOF_ORIGIN } from "./proof.ts";
import type { StaffTokenInfo } from "./staff.ts";
import { mentionFits, type StoryRulesLive } from "./story-mention.ts";

export function isReviewToken(t: unknown): t is string {
  return typeof t === "string" && /^[0-9a-f]{32}$/.test(t);
}

export function storyReviewUrl(token: string): string {
  return `${PROOF_ORIGIN}/story/${token}`;
}

// ── The waiter's read ───────────────────────────────────────────────────────

export type WaiterStoryRow = {
  id: string;
  ig_handle: string | null;
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
  "id, ig_handle, media_url, media_kind, source, mentioned_at, livemode, review, review_place_id, reviewed_at";

/** The Story that holds the story (MESITA-4405), when one does. */
export type WaiterStoryHolder = { state: string; deadline_at: string } | null;

/** Where the story stands for the waiter:
 *   waiting   approve or reject it (status received), or it is too old to
 *             approve (status too_old)
 *   approved  approved; the guest's bonus lands after the re-check
 *   rejected  it never counts here; the guest posts another
 *   used      no open Story holds it any more (past its deadline, refunded,
 *             or rebound): nothing to decide */
export type WaiterState = "waiting" | "approved" | "rejected" | "used";

export function waiterState(row: Pick<WaiterStoryRow, "review">, holder: WaiterStoryHolder, nowMs: number): WaiterState {
  if (row.review === "approved") return "approved";
  if (row.review === "rejected") return "rejected";
  if (!holder || holder.state !== "found" || Date.parse(holder.deadline_at) <= nowMs) return "used";
  return "waiting";
}

/** The page's view of one story. `nowMs` and `rules` decide too_old: an
 *  approval needs the story to outlive the re-check (the DB re-checks). */
export function waiterStoryView(
  row: WaiterStoryRow,
  holder: WaiterStoryHolder,
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
    state: waiterState(row, holder, nowMs),
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
  // A click approves. A code that was typed and does not match still fails.
  if (!body.staffToken) return { ok: true, jti: "click" };
  if (!info || info.version !== 2 || !info.jti) return refuse(403, "staff_code_needed", "That waiter code is not valid");
  return { ok: true, jti: info.jti };
}

/** story_review's refusal codes → HTTP. */
const RPC_REFUSAL: Record<string, { status: number; error: string }> = {
  gone: { status: 404, error: "This Story QR is not valid any more. Ask the guest to show it again." },
  wrong_place: { status: 403, error: "This story is for another place." },
  already_decided: { status: 409, error: "This story was already decided" },
  story_too_old: { status: 409, error: "This story is too old for the bonus. Ask the guest to post a new one." },
};

export function reviewRefusal(code: string | undefined): ReviewRefusal {
  const r = code ? RPC_REFUSAL[code] : undefined;
  return r ? refuse(r.status, code!, r.error) : refuse(500, "server", "Couldn't save. Try again");
}

/** The codes the RPC answers (story-review.test.ts pins the map covers them). */
export const REVIEW_CODES = Object.keys(RPC_REFUSAL);
