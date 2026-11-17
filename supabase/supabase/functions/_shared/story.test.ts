// MESITA-3507, MESITA-4264, MESITA-4297: the Story's pure halves.
import { assertEquals } from "jsr:@std/assert@1";
import { instagramHandleOfUrl, isStoryToken, storyBonusAt, storyState } from "./story.ts";

Deno.test("isStoryToken: 32 lowercase hex only (MESITA-3507)", () => {
  assertEquals(isStoryToken("0123456789abcdef0123456789abcdef"), true);
  assertEquals(isStoryToken("0123456789ABCDEF0123456789abcdef"), false);
  assertEquals(isStoryToken("0123456789abcdef"), false);
  assertEquals(isStoryToken(null), false);
});

Deno.test("storyState: a bought Story is processing, approved (bonus waiting), released or void (MESITA-4297)", () => {
  const base = { status: "paid", story_review: "approved" as const, story_bonus: null };
  assertEquals(storyState({ ...base, status: "open", story_review: null }), "processing");
  assertEquals(storyState({ ...base, status: "opening", story_review: null }), "processing");
  assertEquals(storyState(base), "approved");
  assertEquals(storyState({ ...base, story_bonus: "released" }), "released");
  assertEquals(storyState({ ...base, story_bonus: "void" }), "void");
  assertEquals(storyState({ ...base, story_review: null, story_bonus: "void" }), "void", "not_verified");
});

Deno.test("storyBonusAt: the re-check time, 3 hours after payment", () => {
  assertEquals(storyBonusAt({ story_recheck_at: "2026-11-17T17:05:00Z" }), "2026-11-17T17:05:00Z");
  assertEquals(storyBonusAt({ story_recheck_at: null }), null);
});

Deno.test("instagramHandleOfUrl: the place's username from its URL", () => {
  assertEquals(instagramHandleOfUrl("https://www.instagram.com/Taqueria.Mx/"), "taqueria.mx");
  assertEquals(instagramHandleOfUrl("instagram.com/taq?hl=es"), "taq");
  assertEquals(instagramHandleOfUrl("https://facebook.com/taq"), null);
  assertEquals(instagramHandleOfUrl(null), null);
});
