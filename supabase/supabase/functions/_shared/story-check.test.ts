// MESITA-4296: the check before Pay, its fixed reason order, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { isStoryGateReason, storyCheck, type StoryCheckInput } from "./story-check.ts";
import type { MentionRow } from "./story-mention.ts";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const mention = (agoMin: number, extra: Partial<MentionRow> = {}): MentionRow => ({
  id: `m-${agoMin}`,
  ig_handle: "ana",
  purchase_id: null,
  media_url: "https://x.supabase.co/storage/v1/object/public/story-emulator/u/1.jpg",
  media_kind: "image",
  source: "emulator",
  mentioned_at: new Date(NOW - agoMin * 60_000).toISOString(),
  livemode: false,
  ...extra,
});
const base: StoryCheckInput = {
  placeInstagram: true,
  guestRefusal: null,
  offerReason: null,
  mode: "emulated",
  candidates: [mention(5)],
  livemode: false,
  nowMs: NOW,
  rules: { bonusWaitSec: 10800, checkMarginSec: 5400 },
};

Deno.test("storyCheck: found returns the newest story that fits", () => {
  const r = storyCheck({ ...base, candidates: [mention(5), mention(30)] });
  assertEquals(r.found && r.mention.id, "m-5");
});

Deno.test("storyCheck: the gate reasons in their fixed order, each over the next", () => {
  const all: StoryCheckInput = {
    ...base,
    placeInstagram: false,
    guestRefusal: "needs_instagram",
    offerReason: "needs_visit",
    mode: "unavailable",
    candidates: [],
  };
  const reason = (i: StoryCheckInput) => (storyCheck(i) as { reason?: string }).reason;
  assertEquals(reason(all), "place_no_instagram");
  assertEquals(reason({ ...all, placeInstagram: true }), "needs_instagram");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: "few_followers" }), "few_followers");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: "private_account" }), "private_account");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: null }), "already_bought");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: null, offerReason: null }), "story_unavailable");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: null, offerReason: "paused", mode: "emulated" }), "not_available");
  assertEquals(reason({ ...all, placeInstagram: true, guestRefusal: null, offerReason: null, mode: "emulated" }), "no_story");
});

Deno.test("storyCheck: a story too close to its 24 hours reads story_too_old; none reads no_story", () => {
  const tooOld = mention(19 * 60 + 31);
  assertEquals(storyCheck({ ...base, candidates: [tooOld] }), { found: false, reason: "story_too_old" });
  assertEquals(storyCheck({ ...base, candidates: [] }), { found: false, reason: "no_story" });
  assertEquals(storyCheck({ ...base, candidates: [mention(25 * 60)] }), { found: false, reason: "no_story" }, "a story past 24 hours is gone");
  assertEquals(storyCheck({ ...base, candidates: [mention(5, { livemode: true })] }), { found: false, reason: "story_too_old" }, "the other mode never fits");
});

Deno.test("storyCheck: poll=1 skips the gate and only looks for the story", () => {
  const r = storyCheck({ ...base, pollOnly: true, placeInstagram: false, guestRefusal: "few_followers" });
  assertEquals(r.found, true);
});

Deno.test("isStoryGateReason: the gate hides the Post step; the story loop does not", () => {
  for (const r of ["place_no_instagram", "needs_instagram", "few_followers", "private_account", "already_bought", "story_unavailable", "not_available"] as const) {
    assertEquals(isStoryGateReason(r), true, r);
  }
  assertEquals(isStoryGateReason("no_story"), false);
  assertEquals(isStoryGateReason("story_too_old"), false);
});
