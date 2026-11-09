import { assertEquals } from "jsr:@std/assert@1";
import { isStoryToken, type StoryRow, storyView } from "./story.ts";

const ROW: StoryRow = {
  id: "p",
  status: "paid",
  amount_cents: 10000,
  bonus_cents: 3000,
  currency: "mxn",
  livemode: false,
  paid_at: "2026-11-09T04:00:00Z",
  story_activated_at: null,
  place_id: "pl",
  consumer_id: "c",
};

Deno.test("isStoryToken: 32 lowercase hex only (MESITA-3507)", () => {
  assertEquals(isStoryToken("0123456789abcdef0123456789abcdef"), true);
  assertEquals(isStoryToken("0123456789ABCDEF0123456789abcdef"), false);
  assertEquals(isStoryToken("0123456789abcdef"), false);
  assertEquals(isStoryToken(null), false);
});

Deno.test("storyView: the credit is price plus bonus; a refund before activation reads refunded", () => {
  const v = storyView(ROW, "Taquería", "ana");
  assertEquals(v.credit_cents, 13000);
  assertEquals(v.instagram_handle, "ana");
  assertEquals(v.refunded, false);
  assertEquals(v.test_mode, true);
  assertEquals(storyView({ ...ROW, status: "refunded" }, null, null).refunded, true);
  assertEquals(storyView({ ...ROW, status: "refunded", story_activated_at: "2026-11-09T05:00:00Z" }, null, null).refunded, false);
});
