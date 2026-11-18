// MESITA-4405: the Story record's pure rules, without a database.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  legacyWaitingState,
  type StoryRecord,
  STORY_STATES,
  STORY_VOID_REASONS,
  storyFreesSlot,
  storyNeedsPoll,
  storyView,
} from "./story.ts";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const story = (x: Partial<StoryRecord> = {}): StoryRecord => ({
  id: "s1",
  purchase_id: "p1",
  consumer_id: "c1",
  place_id: "pl1",
  livemode: false,
  state: "waiting_post",
  deadline_at: "2026-11-18T20:00:00Z",
  mention_id: null,
  first_bound_at: null,
  approved_at: null,
  recheck_at: null,
  recheck_tries: 0,
  decided_at: null,
  void_reason: null,
  bonus_cents: 5000,
  created_at: "2026-11-18T08:00:00Z",
  ...x,
});

Deno.test("the states and void reasons are the migration's CHECK lists", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/20261119010000_stories_record.sql", import.meta.url));
  assert(sql.includes(`check (state in (${STORY_STATES.map((s) => `'${s}'`).join(", ")}))`), "states drifted from the SQL CHECK");
  assert(sql.includes(`check (void_reason in (${STORY_VOID_REASONS.map((s) => `'${s}'`).join(", ")}))`), "void reasons drifted");
});

Deno.test("storyFreesSlot: only an expired Story that never had a story frees its visit slot", () => {
  assertEquals(storyFreesSlot(story({ state: "void", void_reason: "expired" })), true);
  assertEquals(storyFreesSlot(story({ state: "void", void_reason: "expired", first_bound_at: "2026-11-18T09:00:00Z" })), false);
  assertEquals(storyFreesSlot(story({ state: "void", void_reason: "refunded" })), false, "a refunded purchase keeps its slot");
  assertEquals(storyFreesSlot(story({ state: "void", void_reason: "unreachable" })), false);
  assertEquals(storyFreesSlot(story()), false, "an open Story holds its slot");
});

Deno.test("storyNeedsPoll: waiting or found before the deadline; never approved, void or late", () => {
  assertEquals(storyNeedsPoll(story(), NOW), true);
  assertEquals(storyNeedsPoll(story({ state: "found" }), NOW), true);
  assertEquals(storyNeedsPoll(story({ state: "approved" }), NOW), false);
  assertEquals(storyNeedsPoll(story({ state: "void" }), NOW), false);
  assertEquals(storyNeedsPoll(story({ deadline_at: "2026-11-18T11:59:59Z" }), NOW), false);
});

Deno.test("storyView: the QR only while found; the bonus time only while approved", () => {
  const mention = {
    id: "m1", media_url: null, media_kind: "image" as const, mentioned_at: "2026-11-18T11:00:00Z", source: "emulator" as const,
    review_token: "0123456789abcdef0123456789abcdef", deleted_at: null,
  };
  const purchase = { amount_cents: 10000, currency: "mxn", paid_at: "2026-11-18T08:00:00Z", status: "paid" };
  const found = storyView(story({ state: "found", mention_id: "m1" }), { purchase, mention, emulator: true, nowMs: NOW });
  assert(found.review_url?.endsWith("/story/0123456789abcdef0123456789abcdef"));
  assertEquals(found.credit_cents, 15000);
  assertEquals(found.emulator, true);
  assert(found.poll !== null);
  const approved = storyView(story({ state: "approved", mention_id: "m1", recheck_at: "2026-11-18T15:00:00Z" }), {
    purchase, mention, emulator: true, nowMs: NOW,
  });
  assertEquals(approved.review_url, null);
  assertEquals(approved.bonus_at, "2026-11-18T15:00:00Z");
  assertEquals(approved.poll, null);
  const live = storyView(story({ livemode: true }), { purchase, mention: null, emulator: true, nowMs: NOW });
  assertEquals(live.emulator, false, "never on a live Story");
  assertEquals(storyView(story(), { purchase: { ...purchase, status: "refunded" }, mention: null, emulator: false, nowMs: NOW }).refunded, true);
});

Deno.test("legacyWaitingState: the old Wallet row's four words", () => {
  assertEquals(legacyWaitingState(story(), NOW), "waiting");
  assertEquals(legacyWaitingState(story({ state: "approved", recheck_at: "2026-11-18T11:00:00Z" }), NOW), "checking");
  assertEquals(legacyWaitingState(story({ state: "released" }), NOW), "released");
  assertEquals(legacyWaitingState(story({ state: "void" }), NOW), "void");
});
