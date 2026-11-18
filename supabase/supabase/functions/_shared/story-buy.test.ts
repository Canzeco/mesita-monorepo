// MESITA-4296, MESITA-4304: the Story buy's own gate, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { isStoryTakenConflict, storyBasketRefusal, storyMentionRefusal } from "./story-buy.ts";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const RULES = { bonusWaitSec: 10800, creditMarginSec: 3600 };
const m = (agoMin: number, extra: Record<string, unknown> = {}) => ({
  ig_handle: "ana",
  purchase_id: null as string | null,
  livemode: false,
  mentioned_at: new Date(NOW - agoMin * 60_000).toISOString(),
  review: "approved" as "approved" | "rejected" | null,
  review_place_id: "place-1" as string | null,
  ...extra,
});

Deno.test("storyBasketRefusal: a Story is paid alone, one unit", () => {
  assertEquals(storyBasketRefusal(["voucher_story"], 1), null);
  assertEquals(storyBasketRefusal(["voucher_200"], 3), null, "no Story, no rule");
  assertEquals(storyBasketRefusal(["voucher_story"], 2)?.code, "story_one_per_basket");
  assertEquals(storyBasketRefusal(["voucher_story", "voucher_200"], 2)?.code, "story_one_per_basket");
});

Deno.test("storyMentionRefusal: each refusal means nothing was charged", () => {
  assertEquals(storyMentionRefusal(m(5), "ana", "place-1", false, NOW, RULES), null);
  assertEquals(storyMentionRefusal(m(5), "Ana", "place-1", false, NOW, RULES), null, "handles compare lower-case");
  assertEquals(storyMentionRefusal(null, "ana", "place-1", false, NOW, RULES)?.code, "story_not_found");
  assertEquals(storyMentionRefusal(m(5), "bob", "place-1", false, NOW, RULES)?.code, "story_not_found", "never another guest's story");
  assertEquals(storyMentionRefusal(m(5), null, "place-1", false, NOW, RULES)?.code, "story_not_found");
  assertEquals(storyMentionRefusal(m(5, { purchase_id: "p" }), "ana", "place-1", false, NOW, RULES)?.code, "story_taken");
  assertEquals(storyMentionRefusal(m(5), "ana", "place-1", true, NOW, RULES)?.code, "story_livemode");
  assertEquals(storyMentionRefusal(m(20 * 60 + 1), "ana", "place-1", false, NOW, RULES)?.code, "story_too_old");
  assertEquals(storyMentionRefusal(m(20 * 60), "ana", "place-1", false, NOW, RULES), null, "exactly at the credit margin");
});

Deno.test("storyMentionRefusal: only a story a waiter of THIS place approved is paid (MESITA-4304)", () => {
  assertEquals(storyMentionRefusal(m(5, { review: null }), "ana", "place-1", false, NOW, RULES)?.code, "story_not_verified");
  assertEquals(storyMentionRefusal(m(5, { review: "rejected" }), "ana", "place-1", false, NOW, RULES)?.code, "story_not_verified");
  assertEquals(storyMentionRefusal(m(5), "ana", "place-2", false, NOW, RULES)?.code, "story_not_verified", "an approval is for one place");
});

Deno.test("isStoryTakenConflict: only the live-reservation index, not the request id", () => {
  assertEquals(isStoryTakenConflict({ code: "23505", message: 'duplicate key value violates unique constraint "wallet_purchases_story_mention_live_idx"' }), true);
  assertEquals(isStoryTakenConflict({ code: "23505", message: 'duplicate key value violates unique constraint "wallet_purchases_request_id_key"' }), false);
  assertEquals(isStoryTakenConflict(null), false);
});
