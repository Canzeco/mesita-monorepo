import { assertEquals } from "jsr:@std/assert@1";
import { instagramHandleOfUrl, isStoryToken, storyBonusAt, type StoryRow, storyState, storyView } from "./story.ts";
import { type MentionRow, storyRulesFrom } from "./story-mention.ts";

const ROW: StoryRow = {
  id: "p",
  status: "paid",
  amount_cents: 10000,
  bonus_cents: 5000,
  currency: "mxn",
  livemode: false,
  paid_at: "2026-11-17T04:00:00Z",
  story_activated_at: null,
  story_review: null,
  story_reviewed_at: null,
  story_recheck_at: null,
  story_bonus: null,
  story_bonus_void_reason: null,
  place_id: "pl",
  consumer_id: "c",
};
const PLACE = { id: "pl", name: "Taquería", instagram_handle: "taqueria", time_zone: "America/Mexico_City" };
const RULES = storyRulesFrom({ story_expiry_anchor: "2026-11-17T00:00:00Z" });
const MENTION: MentionRow = {
  id: "m1",
  ig_handle: "ana",
  purchase_id: null,
  media_url: "https://x.supabase.co/storage/v1/object/public/story-emulator/p/1.jpg?v=1",
  media_kind: "image",
  source: "emulator",
  mentioned_at: "2026-11-17T05:00:00Z",
  livemode: false,
};

Deno.test("isStoryToken: 32 lowercase hex only (MESITA-3507)", () => {
  assertEquals(isStoryToken("0123456789abcdef0123456789abcdef"), true);
  assertEquals(isStoryToken("0123456789ABCDEF0123456789abcdef"), false);
  assertEquals(isStoryToken("0123456789abcdef"), false);
  assertEquals(isStoryToken(null), false);
});

Deno.test("storyState: the columns map to six states (MESITA-4264)", () => {
  const base = { story_review: null, story_reviewed_at: null, story_bonus: null } as const;
  assertEquals(storyState(base, null), "needs_story");
  assertEquals(storyState(base, "2026-11-17T05:00:00Z"), "received");
  const rejected = { ...base, story_review: "rejected" as const, story_reviewed_at: "2026-11-17T06:00:00Z" };
  assertEquals(storyState(rejected, null), "rejected");
  assertEquals(storyState(rejected, "2026-11-17T05:00:00Z"), "rejected", "the story staff rejected does not read received");
  assertEquals(storyState(rejected, "2026-11-17T07:00:00Z"), "received", "a newer story does");
  assertEquals(storyState({ ...base, story_review: "approved" }, null), "approved");
  assertEquals(storyState({ ...base, story_review: "approved", story_bonus: "released" }, null), "released");
  assertEquals(storyState({ ...base, story_review: "approved", story_bonus: "void" }, null), "void");
  assertEquals(storyState({ ...base, story_bonus: "void" }, "2026-11-17T05:00:00Z"), "void", "expired wins over a story");
});

Deno.test("storyView: credit lands at payment, so refunded is any status but paid", () => {
  const v = storyView(ROW, PLACE, "ana", { mentions: [MENTION], claimed: null, rules: RULES });
  assertEquals(v.credit_cents, 15000);
  assertEquals(v.instagram_handle, "ana");
  assertEquals(v.refunded, false);
  assertEquals(v.test_mode, true);
  assertEquals(v.state, "received");
  assertEquals(v.mentions.map((m) => m.id), ["m1"]);
  assertEquals(v.expires_at, "2026-11-24T04:00:00.000Z");
  assertEquals(storyView({ ...ROW, status: "refunded" }, PLACE, null, { mentions: [], claimed: null, rules: RULES }).refunded, true);
  assertEquals(
    storyView({ ...ROW, status: "partly_refunded", story_activated_at: "2026-11-17T05:00:00Z" }, PLACE, null, {
      mentions: [],
      claimed: null,
      rules: RULES,
    }).refunded,
    true,
  );
});

Deno.test("storyView: approved reads approved_at and the bonus 3 hours later", () => {
  const approved = { ...ROW, story_review: "approved" as const, story_activated_at: "2026-11-17T14:05:00Z", story_recheck_at: "2026-11-17T17:05:00Z" };
  const v = storyView(approved, PLACE, "ana", { mentions: [], claimed: { ...MENTION, purchase_id: "p" }, rules: RULES });
  assertEquals(v.state, "approved");
  assertEquals(v.approved_at, "2026-11-17T14:05:00Z");
  assertEquals(v.activated_at, v.approved_at);
  assertEquals(v.bonus_at, "2026-11-17T17:05:00.000Z");
  assertEquals(v.claimed_mention?.id, "m1");
  assertEquals(storyBonusAt({ story_activated_at: null }, RULES), null);
});

Deno.test("instagramHandleOfUrl: the place's username from its URL", () => {
  assertEquals(instagramHandleOfUrl("https://www.instagram.com/Taqueria.Mx/"), "taqueria.mx");
  assertEquals(instagramHandleOfUrl("instagram.com/taq?hl=es"), "taq");
  assertEquals(instagramHandleOfUrl("https://facebook.com/taq"), null);
  assertEquals(instagramHandleOfUrl(null), null);
});
