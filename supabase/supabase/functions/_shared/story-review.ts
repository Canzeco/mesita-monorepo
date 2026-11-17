// Staff's approve / reject of a Story (MESITA-4264): the pure half of
// visit-web-review-story, so the rules test without a database.
//
// The guest holds the Story QR, so the token alone never approves anything:
// the phone must carry a current `s2` waiter-code staff token of the
// purchase's place (_shared/staff.ts, the tab Verify's rule). Without one,
// or with another place's, the answer is 403 staff_code_needed / forbidden.

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
  if (!isStoryToken(b.token)) return refuse(400, "bad_request", "That is not a Story voucher");
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

/** The staff gate: a current s2 token (a device id) for the purchase's
 *  place. `info` is readStaffToken's answer against that place's keys. */
export function staffGate(
  body: Pick<ReviewBody, "staffToken" | "placeId">,
  purchasePlaceId: string,
  info: StaffTokenInfo | null,
): { ok: true; jti: string } | ReviewRefusal {
  if (body.placeId && body.placeId !== purchasePlaceId) return refuse(403, "forbidden", "This voucher is for another place.");
  if (!body.staffToken || !info || info.version !== 2 || !info.jti) return refuse(403, "staff_code_needed", "Type the waiter code");
  return { ok: true, jti: info.jti };
}

/** The RPC's refusal codes → HTTP. */
const RPC_REFUSAL: Record<string, { status: number; error: string }> = {
  gone: { status: 404, error: "This Story voucher is not valid. Ask the guest to show it again." },
  refunded: { status: 409, error: "This voucher was refunded" },
  not_paid: { status: 409, error: "This voucher is not paid" },
  already_decided: { status: 409, error: "This Story was already decided" },
  mention_claimed: { status: 409, error: "This story was just used. Refreshing…" },
  mention_expired: { status: 409, error: "This story is too old or gone. Refreshing…" },
  handle_mismatch: { status: 409, error: "This story is from another Instagram account" },
  livemode_mismatch: { status: 409, error: "A test story cannot approve a real voucher" },
  reload: { status: 409, error: "This page changed. Reload it." },
};

export function reviewRefusal(code: string | undefined): ReviewRefusal {
  const r = code ? RPC_REFUSAL[code] : undefined;
  return r ? refuse(r.status, code!, r.error) : refuse(500, "server", "Couldn't save. Try again");
}
