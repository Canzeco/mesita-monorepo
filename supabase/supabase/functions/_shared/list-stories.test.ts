// MESITA-4738 — consumer-web-list-stories: whose stories, which mode, what leaves.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getStory, listStories, STORIES_LIMIT, storyCheckedAt, storyFailedAt } from "./list-stories.ts";
import { STORY_REJECT_WORDS, type StoryRejectReason } from "./story-reward.ts";

type Call = { table: string; select: string; filters: Array<[string, string, unknown]>; limit?: number };

const ME = "00000000-0000-4000-8000-000000000001";
const PLACE = "00000000-0000-4000-8000-0000000000aa";

function mention(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    place_id: PLACE,
    state: "rewarded",
    reward_cents: 5000,
    mentioned_at: "2026-11-23T10:00:00.000Z",
    decided_at: "2026-11-23T20:00:00.000Z",
    source: "meta",
    // Columns a careless select would carry; the map must drop them.
    ai_verdict: { secret: true },
    sender_igsid: "1789",
    media_url: "https://cdn.example/story.jpg",
    consumer_id: ME,
    ...extra,
  };
}

function stub(rows: { mentions: unknown[]; entries?: unknown[] }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, select: "", filters: [] };
      calls.push(call);
      const answer = () => {
        if (table === "story_mentions") return { data: rows.mentions.slice(0, call.limit ?? rows.mentions.length), error: null };
        if (table === "wallet_entries") return { data: rows.entries ?? [], error: null };
        return { data: [{ id: PLACE, slug: "orinoco", name: "Orinoco", profile_photo: "p.jpg", boost_tier: 0, currency: "MXN" }], error: null };
      };
      const q: Record<string, unknown> = {
        select(s: string) { call.select = s; return q; },
        eq(c: string, v: unknown) { call.filters.push(["eq", c, v]); return q; },
        in(c: string, v: unknown) { call.filters.push(["in", c, v]); return q; },
        order() { return q; },
        limit(n: number) { call.limit = n; return q; },
        maybeSingle() { const a = answer() as { data: unknown[] }; return Promise.resolve({ data: a.data[0] ?? null, error: null }); },
        then(resolve: (v: unknown) => void) { resolve(answer()); },
      };
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

Deno.test("a guest lists only their own stories, in the wallet's money mode", async () => {
  const { client, calls } = stub({ mentions: [mention(1)] });
  await listStories(client, ME, true);
  const m = calls.find((c) => c.table === "story_mentions")!;
  assertEquals(m.filters, [["eq", "consumer_id", ME], ["eq", "livemode", true]]);
  const e = calls.find((c) => c.table === "wallet_entries")!;
  assert(e.filters.some((f) => f[0] === "eq" && f[1] === "consumer_id" && f[2] === ME));
  assert(e.filters.some((f) => f[0] === "eq" && f[1] === "kind" && f[2] === "story"));
});

Deno.test("only listed fields leave; a rewarded story carries the credit written", async () => {
  const m = mention(1);
  const { client } = stub({ mentions: [m], entries: [{ story_mention_id: m.id, amount_cents: 4000, currency: "MXN" }] });
  const res = await listStories(client, ME, false);
  assert(res.ok);
  assertEquals(res.stories[0], {
    id: m.id,
    place: { id: PLACE, name: "Orinoco", slug: "orinoco", photo_url: "p.jpg" },
    state: "rewarded",
    credit_cents: 4000,
    currency: "mxn",
    posted_at: m.mentioned_at,
    decided_at: m.decided_at,
    simulated: false,
  });
});

Deno.test("a story not rewarded shows no money, even with a stored reward", async () => {
  const { client } = stub({ mentions: [mention(1, { state: "verified" }), mention(2, { state: "rejected", reward_cents: null })] });
  const res = await listStories(client, ME, false);
  assert(res.ok);
  assertEquals(res.stories.map((s) => s.credit_cents), [null, null]);
});

Deno.test("more than the limit reads as truncated", async () => {
  const many = Array.from({ length: STORIES_LIMIT + 1 }, (_, i) => mention(i + 1));
  const { client } = stub({ mentions: many });
  const res = await listStories(client, ME, false);
  assert(res.ok);
  assertEquals(res.stories.length, STORIES_LIMIT);
  assertEquals(res.truncated, true);
});

// ── MESITA-4747: one story's ticket ────────────────────────────────────────

const ONE = "00000000-0000-4000-8000-000000000001";

Deno.test("a guest reads only their own story, by id, in the wallet's money mode", async () => {
  const { client, calls } = stub({ mentions: [mention(1)] });
  await getStory(client, ME, true, ONE);
  const m = calls.find((c) => c.table === "story_mentions")!;
  assertEquals(m.filters, [["eq", "id", ONE], ["eq", "consumer_id", ME], ["eq", "livemode", true]]);
  assert(!m.select.includes("ai_verdict") && !m.select.includes("media_url") && !m.select.includes("sender"));
  const e = calls.find((c) => c.table === "wallet_entries")!;
  assert(e.filters.some((f) => f[0] === "eq" && f[1] === "consumer_id" && f[2] === ME));
  assert(e.filters.some((f) => f[0] === "eq" && f[1] === "kind" && f[2] === "story"));
});

Deno.test("no such story of this guest reads as null, not someone else's", async () => {
  const { client } = stub({ mentions: [] });
  const res = await getStory(client, ME, false, ONE);
  assert(res.ok);
  assertEquals(res.story, null);
});

Deno.test("only the ticket's fields leave; a rewarded story carries the credit written", async () => {
  const m = mention(1, { ai_checked_at: "2026-11-23T10:05:00.000Z", recheck_at: "2026-11-23T20:05:00.000Z", reject_reason: null });
  const { client } = stub({ mentions: [m], entries: [{ story_mention_id: m.id, amount_cents: 4000, currency: "MXN" }] });
  const res = await getStory(client, ME, false, m.id);
  assert(res.ok && res.story);
  assertEquals(res.story, {
    id: m.id,
    place: { id: PLACE, name: "Orinoco", slug: "orinoco", photo_url: "p.jpg" },
    state: "rewarded",
    posted_at: m.mentioned_at,
    checked_at: "2026-11-23T10:05:00.000Z",
    recheck_at: "2026-11-23T20:05:00.000Z",
    decided_at: m.decided_at,
    reward_cents: 4000,
    credit_cents: 4000,
    currency: "mxn",
    reason: null,
    failed_at: null,
    simulated: false,
  });
});

Deno.test("a verified story promises its amount but carries no credit; a rejected one neither", async () => {
  const verified = mention(1, { state: "verified", decided_at: null, recheck_at: "2026-11-23T20:00:00.000Z", reject_reason: null, ai_checked_at: null });
  let { client } = stub({ mentions: [verified] });
  let res = await getStory(client, ME, false, verified.id);
  assert(res.ok && res.story);
  assertEquals([res.story.reward_cents, res.story.credit_cents], [5000, null]);

  const rejected = mention(2, { state: "rejected", reject_reason: "removed", recheck_at: "2026-11-23T20:00:00.000Z", ai_checked_at: null });
  ({ client } = stub({ mentions: [rejected] }));
  res = await getStory(client, ME, false, rejected.id);
  assert(res.ok && res.story);
  assertEquals([res.story.reward_cents, res.story.credit_cents, res.story.failed_at], [null, null, "recheck"]);
  assertEquals(res.story.reason, STORY_REJECT_WORDS.removed);
});

Deno.test("every reject reason has plain words, and its failing step", () => {
  const reasons: StoryRejectReason[] = [
    "no_guest", "no_tag", "several_places", "not_a_story", "video", "unreadable", "off", "repeat", "expired", "removed",
  ];
  for (const r of reasons) {
    assert(STORY_REJECT_WORDS[r] && !STORY_REJECT_WORDS[r].includes("_"), r);
    assertEquals(storyFailedAt({ state: "rejected", reject_reason: r, recheck_at: null }), r === "removed" ? "recheck" : "check");
  }
  // story_reward_pay rejects at the recheck (off, no_guest): recheck_at is set.
  assertEquals(storyFailedAt({ state: "rejected", reject_reason: "off", recheck_at: "2026-11-23T20:00:00.000Z" }), "recheck");
  assertEquals(storyFailedAt({ state: "verified", reject_reason: null, recheck_at: "2026-11-23T20:00:00.000Z" }), null);
});

Deno.test("the check's time: the bot's stamp, else the emulator's post, else the decision", () => {
  const base = { mentioned_at: "A", recheck_at: null, decided_at: null, ai_checked_at: null, source: "meta" };
  assertEquals(storyCheckedAt({ ...base, state: "checking" }), null);
  assertEquals(storyCheckedAt({ ...base, state: "verified", ai_checked_at: "B", recheck_at: "C" }), "B");
  assertEquals(storyCheckedAt({ ...base, state: "verified", source: "emulator", recheck_at: "C" }), "A");
  assertEquals(storyCheckedAt({ ...base, state: "rejected", decided_at: "D" }), "D");
});
