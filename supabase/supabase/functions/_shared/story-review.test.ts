// MESITA-4304: the waiter's step, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { readReviewBody, REVIEW_CODES, reviewRefusal, staffGate, waiterState, waiterStoryView, type WaiterStoryRow } from "./story-review.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const PLACE = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

Deno.test("readReviewBody: a token, a decision; nothing else approves", () => {
  assertEquals(readReviewBody({ token: "nope", decision: "approve" }).ok, false);
  assertEquals(readReviewBody({ token: TOKEN }).ok, false, "no decision");
  assertEquals(readReviewBody({ token: TOKEN, decision: "maybe" }).ok, false);
  const r = readReviewBody({ token: TOKEN, decision: "approve", staff_token: "s2.x", place_id: PLACE });
  assertEquals(r.ok && r.body.staffToken, "s2.x");
});

Deno.test("staffGate: a click approves; a bad token of the story's place does not", () => {
  const info = { version: 2 as const, src: "code" as const, jti: "j".repeat(22), exp: 0 };
  assertEquals(staffGate({ staffToken: "t", placeId: PLACE }, PLACE, info).ok, true);
  assertEquals((staffGate({ staffToken: "t", placeId: OTHER }, PLACE, info) as { code: string }).code, "wrong_place");
  assertEquals(staffGate({ staffToken: null, placeId: PLACE }, PLACE, null).ok, true);
  assertEquals((staffGate({ staffToken: "t", placeId: PLACE }, PLACE, null) as { code: string }).code, "staff_code_needed", "another place's token never verifies");
  assertEquals((staffGate({ staffToken: "t", placeId: PLACE }, PLACE, { ...info, version: 1, jti: null }) as { code: string }).code, "staff_code_needed");
});

Deno.test("reviewRefusal: every RPC code has its status; anything else is a 500", () => {
  assertEquals(REVIEW_CODES.sort(), ["already_decided", "gone", "story_too_old", "wrong_place"]);
  assertEquals(reviewRefusal("gone").status, 404);
  assertEquals(reviewRefusal("story_too_old").status, 409);
  assertEquals(reviewRefusal("what").status, 500);
});

Deno.test("waiterState and the too_old status", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const open = { state: "found", deadline_at: "2026-11-17T20:00:00Z" };
  assertEquals(waiterState({ review: "approved" }, open, now), "approved");
  assertEquals(waiterState({ review: "rejected" }, null, now), "rejected");
  assertEquals(waiterState({ review: null }, open, now), "waiting");
  assertEquals(waiterState({ review: null }, null, now), "used", "no Story holds it");
  assertEquals(waiterState({ review: null }, { ...open, deadline_at: "2026-11-17T11:00:00Z" }, now), "used", "past the deadline");
  assertEquals(waiterState({ review: null }, { ...open, state: "void" }, now), "used");
  const row = (agoMin: number): WaiterStoryRow => ({
    id: "m", ig_handle: "ana", media_url: null, media_kind: "image", source: "emulator",
    mentioned_at: new Date(now - agoMin * 60_000).toISOString(), livemode: false, review: null, review_place_id: PLACE, reviewed_at: null,
  });
  const rules = { bonusWaitSec: 10800, checkMarginSec: 5400 };
  const place = { id: PLACE, name: "P", instagram_handle: "p" };
  assertEquals(waiterStoryView(row(5), open, place, true, now, rules).story.status, "received");
  assertEquals(waiterStoryView(row(19 * 60 + 31), open, place, true, now, rules).story.status, "too_old");
});
