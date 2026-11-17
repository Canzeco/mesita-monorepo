// MESITA-4297: the story check's pure halves — the view, the buy door, the
// guest's door.
import { assertEquals } from "jsr:@std/assert@1";
import { type CheckRow, checkView, guestCheckRefusal, liveState, storyBuyGate, storyNotVerified, storyStatus } from "./story-check.ts";
import { type MentionRow, storyRulesFrom } from "./story-mention.ts";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const RULES = storyRulesFrom(null);
const ROW: CheckRow = {
  id: "c1",
  consumer_id: "u",
  place_id: "pl",
  token: "0123456789abcdef0123456789abcdef",
  livemode: false,
  state: "open",
  last_rejected_at: null,
  approved_at: null,
  reviewed_at: null,
  used_by_purchase: null,
  created_at: "2026-11-17T11:00:00Z",
  expires_at: "2026-11-18T11:00:00Z",
};
const STORY: MentionRow = {
  id: "m1",
  ig_handle: "ana",
  purchase_id: null,
  check_id: null,
  media_url: "https://x.supabase.co/storage/v1/object/public/story-emulator/c1/1.jpg?v=1",
  media_kind: "image",
  source: "emulator",
  mentioned_at: "2026-11-17T11:50:00Z",
  livemode: false,
};
const url = (t: string) => `https://visit.mesita.ai/story/${t}`;

Deno.test("liveState: an open or approved check past its time reads expired", () => {
  assertEquals(liveState(ROW, NOW), "open");
  assertEquals(liveState({ ...ROW, expires_at: "2026-11-17T11:59:00Z" }, NOW), "expired");
  assertEquals(liveState({ ...ROW, state: "approved", expires_at: "2026-11-17T11:59:00Z" }, NOW), "expired");
  assertEquals(liveState({ ...ROW, state: "used", expires_at: "2026-11-17T11:59:00Z" }, NOW), "used");
});

Deno.test("storyStatus: waiting, received, too_old past 16 h 30 min", () => {
  assertEquals(storyStatus(null, RULES, NOW), "waiting");
  assertEquals(storyStatus(STORY, RULES, NOW), "received");
  assertEquals(storyStatus({ mentioned_at: "2026-11-16T19:29:00Z" }, RULES, NOW), "too_old");
  assertEquals(storyStatus({ mentioned_at: "2026-11-16T19:31:00Z" }, RULES, NOW), "received");
});

Deno.test("checkView: the QR, the state, the story and the limits", () => {
  const v = checkView(ROW, STORY, RULES, NOW, url);
  assertEquals(v.url, `https://visit.mesita.ai/story/${ROW.token}`);
  assertEquals([v.state, v.story_status, v.story?.status, v.story?.id], ["open", "received", "received", "m1"]);
  assertEquals(v.limits, { approve_valid_sec: 7200, max_story_age_sec: 59400, bonus_wait_sec: 10800 });
  assertEquals(v.test_mode, true);
  assertEquals(checkView(ROW, null, RULES, NOW, url).story_status, "waiting");
  const approved = checkView(
    { ...ROW, state: "approved", approved_at: "2026-11-17T11:55:00Z", expires_at: "2026-11-17T13:55:00Z" },
    { ...STORY, mentioned_at: "2026-11-16T19:00:00Z", check_id: "c1" },
    RULES,
    NOW,
    url,
  );
  assertEquals([approved.state, approved.story_status, approved.approved_at], ["approved", "received", "2026-11-17T11:55:00Z"],
    "an approved story was within the limit when approved");
});

Deno.test("storyBuyGate: only an approved, unexpired, unpresented check of this mode", () => {
  const approved = { ...ROW, state: "approved" as const, expires_at: "2026-11-17T13:00:00Z" };
  assertEquals(storyBuyGate(approved, false, 0, NOW), { ok: true, checkId: "c1" });
  assertEquals(storyBuyGate(null, false, 0, NOW).ok ? null : "no_check", "no_check");
  const r = (g: ReturnType<typeof storyBuyGate>) => (g.ok ? null : g.reason);
  assertEquals(r(storyBuyGate(ROW, false, 0, NOW)), "no_check", "open: not approved yet");
  assertEquals(r(storyBuyGate({ ...approved, expires_at: "2026-11-17T11:00:00Z" }, false, 0, NOW)), "expired");
  assertEquals(r(storyBuyGate(approved, true, 0, NOW)), "mode_mismatch");
  assertEquals(r(storyBuyGate(approved, false, 1, NOW)), "used", "another live purchase already presents it");
  assertEquals(r(storyBuyGate({ ...approved, state: "used" }, false, 0, NOW)), "used");
});

Deno.test("storyNotVerified: the 409 names the reason; used asks for a new story", () => {
  const used = storyNotVerified({ ok: false, reason: "used", check_state: "used", expires_at: null });
  assertEquals([used.code, used.reason], ["story_not_verified", "used"]);
  assertEquals(used.error.includes("new story"), true);
  const exp = storyNotVerified({ ok: false, reason: "expired", check_state: "expired", expires_at: "x" });
  assertEquals(exp.error.includes("approved again"), true);
});

Deno.test("guestCheckRefusal: unavailable, no Instagram, too few followers", () => {
  const ok = { instagram_handle: "ana", instagram_followers_count: 5000 };
  assertEquals(guestCheckRefusal("emulated", ok, 1000), null);
  assertEquals(guestCheckRefusal("unavailable", ok, 1000)?.code, "story_unavailable");
  assertEquals(guestCheckRefusal("meta", null, 1000)?.status, 403);
  assertEquals(guestCheckRefusal("meta", { ...ok, instagram_handle: null }, 1000)?.code, "needs_instagram");
  const few = guestCheckRefusal("meta", { ...ok, instagram_followers_count: 900 }, 1000);
  assertEquals([few?.status, few?.code, few?.min_followers, few?.followers], [403, "few_followers", 1000, 900]);
});
