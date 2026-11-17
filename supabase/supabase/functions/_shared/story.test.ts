// MESITA-4296: where a paid Story stands on the Wallet, without a database.
import { assertEquals } from "jsr:@std/assert@1";
import { storyBonusAt, storyState } from "./story.ts";

const NOW = Date.parse("2026-11-17T12:00:00Z");

Deno.test("storyState: waiting until the re-check time, checking after, then the decision", () => {
  assertEquals(storyState({ story_bonus: null, story_recheck_at: "2026-11-17T13:00:00Z" }, NOW), "waiting");
  assertEquals(storyState({ story_bonus: null, story_recheck_at: "2026-11-17T12:00:00Z" }, NOW), "checking", "the time has come");
  assertEquals(storyState({ story_bonus: null, story_recheck_at: null }, NOW), "waiting");
  assertEquals(storyState({ story_bonus: "released", story_recheck_at: "2026-11-17T09:00:00Z" }, NOW), "released");
  assertEquals(storyState({ story_bonus: "void", story_recheck_at: null }, NOW), "void");
});

Deno.test("storyBonusAt: the claim (payment) + the wait; none before the claim", () => {
  assertEquals(storyBonusAt({ story_activated_at: "2026-11-17T09:00:00Z" }, { bonusWaitSec: 10800 }), "2026-11-17T12:00:00.000Z");
  assertEquals(storyBonusAt({ story_activated_at: null }, { bonusWaitSec: 10800 }), null);
});
