// MESITA-4264, MESITA-4297: approving a story check needs the waiter code of the check's place.
import { assertEquals } from "jsr:@std/assert@1";
import { readReviewBody, REVIEW_CODES, reviewRefusal, staffGate } from "./story-review.ts";
import { mintStaffToken, readStaffToken } from "./staff.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const PLACE = "00000000-0000-4000-8000-000000004264";
const OTHER = "00000000-0000-4000-8000-000000009999";
const MENTION = "00000000-0000-4000-8000-0000000a4264";
const KEYS = { codeHash: "hash-of-code", staffQr: null };
const SERVICE = "service-key";

Deno.test("an old staff page's body (no decision) gets 409 reload, never an approve", () => {
  const r = readReviewBody({ token: TOKEN });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals([r.status, r.code], [409, "reload"]);
});

Deno.test("readReviewBody: approve needs a story; reject does not", () => {
  const a = readReviewBody({ token: TOKEN, decision: "approve" });
  assertEquals(a.ok ? null : a.code, "bad_request");
  const ok = readReviewBody({ token: TOKEN, decision: "approve", mention_id: MENTION, staff_token: "s2.x" });
  assertEquals(ok.ok && ok.body.mentionId, MENTION);
  const rej = readReviewBody({ token: TOKEN, decision: "reject" });
  assertEquals(rej.ok && rej.body.decision, "reject");
  const bad = readReviewBody({ token: "nope", decision: "reject" });
  assertEquals(bad.ok ? null : bad.code, "bad_request");
});

Deno.test("staffGate: no staff token is 403 staff_code_needed", async () => {
  const info = null;
  const g = staffGate({ staffToken: null, placeId: null }, PLACE, info);
  assertEquals(g.ok ? null : [g.status, g.code], [403, "staff_code_needed"]);
  // A token of the right place passes.
  const { token } = await mintStaffToken(SERVICE, PLACE, KEYS, Date.now());
  const mine = await readStaffToken(SERVICE, PLACE, token, KEYS, Date.now());
  assertEquals(staffGate({ staffToken: token, placeId: PLACE }, PLACE, mine).ok, true);
});

Deno.test("staffGate: another place's staff token is refused", async () => {
  const { token } = await mintStaffToken(SERVICE, OTHER, KEYS, Date.now());
  // Read against the CHECK's place, the HMAC fails: no info.
  const info = await readStaffToken(SERVICE, PLACE, token, KEYS, Date.now());
  assertEquals(info, null);
  const g = staffGate({ staffToken: token, placeId: null }, PLACE, info);
  assertEquals(g.ok ? null : g.code, "staff_code_needed");
  // A waiter whose page names another place: 403 wrong_place.
  const g2 = staffGate({ staffToken: token, placeId: OTHER }, PLACE, info);
  assertEquals(g2.ok ? null : [g2.status, g2.code], [403, "wrong_place"]);
});

Deno.test("staffGate: an s1 token (no device id) must type the code again", () => {
  const g = staffGate({ staffToken: "s1.x", placeId: null }, PLACE, { version: 1, src: null, jti: null, exp: 0 });
  assertEquals(g.ok ? null : g.code, "staff_code_needed");
});

Deno.test("reviewRefusal: stable codes; unknown is a server error without database text", () => {
  assertEquals(reviewRefusal("story_claimed").status, 409);
  assertEquals(reviewRefusal("story_too_old").code, "story_too_old");
  // Every code wallet_review_story_check answers has its own copy.
  for (const c of ["gone", "already_decided", "story_gone", "story_claimed", "story_too_old", "handle_mismatch", "emulator_on_live"]) {
    assertEquals(REVIEW_CODES.includes(c), true, c);
  }
  assertEquals(reviewRefusal("gone").status, 404);
  assertEquals(reviewRefusal("reload").code, "reload");
  const s = reviewRefusal("weird");
  assertEquals([s.status, s.code, s.error], [500, "server", "Couldn't save. Try again"]);
});
