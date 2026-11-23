// MESITA-4714 (Post): a verified story is guest money. Pin the rules
// story_reward_grant mirrors (Off, no guest, once per guest per place per 7
// days, the recheck 10 hours later; MESITA-4717), the owner's allowed amounts,
// and the webhook parse.
import { assertEquals } from "jsr:@std/assert@1";
import {
  emulatorRefusal,
  instagramHandleOfUrl,
  nextStoryRewardAt,
  parseStoryMentions,
  STORY_RECHECK_SEC,
  STORY_REWARD_WINDOW_SEC,
  storyRewardDecision,
} from "./story-reward.ts";
import { readCashbackInput } from "./cashback.ts";

const NOW = Date.parse("2026-11-23T18:00:00Z");
const DAY = 24 * 3600 * 1000;

Deno.test("story reward: promises the place's amount, paid at the recheck 10 hours later (MESITA-4717)", () => {
  const d = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: null, nowMs: NOW });
  assertEquals(d, { pay: true, cents: 2000, recheckAtMs: NOW + STORY_RECHECK_SEC * 1000 });
  const late = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: null, nowMs: NOW, postedAtMs: NOW - 20 * 3600_000 });
  assertEquals(late.pay && late.recheckAtMs, NOW + 3 * 3600_000, "never past the story's 23rd hour");
  const emu = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: null, nowMs: NOW, emulator: true });
  assertEquals(emu.pay && emu.recheckAtMs, NOW + 120_000, "test mode rechecks after 2 minutes");
  const big = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 5000, lastRewardAtMs: null, nowMs: NOW });
  assertEquals(big.pay && big.cents, 5000);
});

Deno.test("story reward: Off pays nothing (the reward Off, or Loyalty Cards Off)", () => {
  assertEquals(storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 0, lastRewardAtMs: null, nowMs: NOW }), { pay: false, reason: "off" });
  assertEquals(storyRewardDecision({ guestMatched: true, loyaltyCards: false, rewardCents: 2000, lastRewardAtMs: null, nowMs: NOW }), { pay: false, reason: "off" });
});

Deno.test("story reward: a story from no verified guest pays nothing", () => {
  assertEquals(storyRewardDecision({ guestMatched: false, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: null, nowMs: NOW }), { pay: false, reason: "no_guest" });
});

Deno.test("story reward: once per guest per place per 7 days", () => {
  const within = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: NOW - 6 * DAY, nowMs: NOW });
  assertEquals(within, { pay: false, reason: "repeat" });
  const edge = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: NOW - STORY_REWARD_WINDOW_SEC * 1000 + 1, nowMs: NOW });
  assertEquals(edge, { pay: false, reason: "repeat" });
  const after = storyRewardDecision({ guestMatched: true, loyaltyCards: true, rewardCents: 2000, lastRewardAtMs: NOW - 7 * DAY, nowMs: NOW });
  assertEquals(after.pay, true);
  assertEquals(nextStoryRewardAt(NOW - 6 * DAY, NOW), new Date(NOW + DAY).toISOString());
  assertEquals(nextStoryRewardAt(NOW - 8 * DAY, NOW), null);
  assertEquals(nextStoryRewardAt(null, NOW), null);
});

Deno.test("story reward: the owner picks only Off, 20 or 50; absent keeps the saved one", () => {
  const base = { welcome_bps: 1000, returning_bps: 500 };
  for (const c of [0, 2000, 5000]) assertEquals(readCashbackInput({ ...base, story_reward_cents: c }).ok, true);
  for (const c of [1000, 2500, -2000, "2000", 20]) assertEquals(readCashbackInput({ ...base, story_reward_cents: c }).ok, false);
  const absent = readCashbackInput(base);
  assertEquals(absent.ok && "story_reward_cents" in absent.rates, false);
});

Deno.test("story reward: the emulator is test mode only, with a linked Instagram", () => {
  assertEquals(emulatorRefusal(true, true)?.code, "not_test_mode");
  assertEquals(emulatorRefusal(false, false)?.code, "no_instagram");
  assertEquals(emulatorRefusal(false, true), null);
});

Deno.test("story mentions: Meta's webhook parses once per attachment, echoes dropped", () => {
  const body = {
    object: "instagram",
    entry: [{
      messaging: [
        { sender: { id: "s1" }, timestamp: NOW, message: { mid: "m1", attachments: [{ type: "story_mention", payload: { url: "https://lookaside.fbsbx.com/x" } }, { type: "story_mention", payload: {} }] } },
        { sender: { id: "s1" }, timestamp: NOW, message: { mid: "m1", attachments: [{ type: "story_mention", payload: { url: "https://lookaside.fbsbx.com/x" } }] } },
        { sender: { id: "s2" }, message: { mid: "m2", is_echo: true, attachments: [{ type: "story_mention" }] } },
        { sender: { id: "s3" }, message: { mid: "m3", attachments: [{ type: "image" }] } },
      ],
    }],
  };
  const got = parseStoryMentions(body);
  assertEquals(got.map((m) => m.storyId), ["m1", "m1#1"]);
  assertEquals(got[1].url, null);
  assertEquals(parseStoryMentions({ object: "page", entry: [] }), []);
});

Deno.test("story reward: a place's handle comes from its Instagram URL", () => {
  assertEquals(instagramHandleOfUrl("https://www.instagram.com/Taqueria.Uno/"), "taqueria.uno");
  assertEquals(instagramHandleOfUrl("instagram.com/abc?hl=en"), "abc");
  assertEquals(instagramHandleOfUrl("https://example.com/abc"), null);
  assertEquals(instagramHandleOfUrl(null), null);
});
