// The waiter's approve / reject of a story check (MESITA-4264, MESITA-4297):
// the pure half of visit-web-review-story, so the rules test without a
// database.
//
// The guest holds the Story QR, so the token alone never approves anything:
// the phone must carry a current `s2` waiter-code staff token of the CHECK's
// place (_shared/staff.ts, the tab Verify's rule). Without one the answer is
// 403 staff_code_needed; a waiter of another place gets 403 wrong_place.

import { isUuid } from "./place-id.ts";
import { isStoryToken } from "./story.ts";
import type { StaffTokenInfo } from "./staff.ts";

export type ReviewBody = {
  token: string;
  decision: "approve" | "reject";
  mentionId: string | null;
  staffToken: string | null;
  placeId: string | null;
};

export type ReviewRefusal = { ok: false; status: number; code: string; error: string };

const refuse = (status: number, code: string, error: string): ReviewRefusal => ({ ok: false, status, code, error });

/** The body, or the refusal. A body without a decision is a staff page from
 *  before MESITA-4264 (its Activate tap): 409 reload, never an approve. */
export function readReviewBody(b: Record<string, unknown>): { ok: true; body: ReviewBody } | ReviewRefusal {
  if (!isStoryToken(b.token)) return refuse(400, "bad_request", "That is not a Story QR");
  if (b.decision === undefined || b.decision === null) return refuse(409, "reload", "This page changed. Reload it.");
  if (b.decision !== "approve" && b.decision !== "reject") return refuse(400, "bad_request", "decision must be approve or reject");
  const mentionId = b.mention_id === undefined || b.mention_id === null ? null : b.mention_id;
  if (mentionId !== null && !isUuid(mentionId)) return refuse(400, "bad_request", "mention_id must be a story id");
  if (b.decision === "approve" && mentionId === null) return refuse(400, "bad_request", "Pick the story to approve");
  if (b.place_id !== undefined && b.place_id !== null && !isUuid(b.place_id)) {
    return refuse(400, "bad_request", "place_id must be a Mesita place id");
  }
  const staffToken = typeof b.staff_token === "string" && b.staff_token.length <= 128 ? b.staff_token : null;
  return {
    ok: true,
    body: {
      token: b.token,
      decision: b.decision,
      mentionId: mentionId as string | null,
      staffToken,
      placeId: (b.place_id as string | null | undefined) ?? null,
    },
  };
}

/** The staff gate: a current s2 token (a device id) for the check's place.
 *  `info` is readStaffToken's answer against that place's keys, so another
 *  place's token never verifies. */
export function staffGate(
  body: Pick<ReviewBody, "staffToken" | "placeId">,
  checkPlaceId: string,
  info: StaffTokenInfo | null,
): { ok: true; jti: string } | ReviewRefusal {
  if (body.placeId && body.placeId !== checkPlaceId) return refuse(403, "wrong_place", "This story is for another place.");
  if (!body.staffToken || !info || info.version !== 2 || !info.jti) return refuse(403, "staff_code_needed", "Type the waiter code");
  return { ok: true, jti: info.jti };
}

/** The RPC's refusal codes → HTTP. */
const RPC_REFUSAL: Record<string, { status: number; error: string }> = {
  gone: { status: 404, error: "This Story QR is not valid any more. Ask the guest to show it again." },
  already_decided: { status: 409, error: "This story was already decided" },
  story_gone: { status: 409, error: "This story is gone. Refreshing…" },
  story_claimed: { status: 409, error: "This story was already used. Refreshing…" },
  story_too_old: { status: 409, error: "This story is too old for the bonus. Ask the guest to post a new one." },
  handle_mismatch: { status: 409, error: "This story is from another Instagram account" },
  emulator_on_live: { status: 409, error: "A test story cannot approve a real Story" },
  reload: { status: 409, error: "This page changed. Reload it." },
};

export function reviewRefusal(code: string | undefined): ReviewRefusal {
  const r = code ? RPC_REFUSAL[code] : undefined;
  return r ? refuse(r.status, code!, r.error) : refuse(500, "server", "Couldn't save. Try again");
}

/** The codes the RPC answers (story-review.test.ts pins the map covers them). */
export const REVIEW_CODES = Object.keys(RPC_REFUSAL);
