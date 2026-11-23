// MESITA-4738 — consumer-web-list-stories: whose stories, which mode, what leaves.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { listStories, STORIES_LIMIT } from "./list-stories.ts";

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
        return { data: [{ id: PLACE, slug: "orinoco", name: "Orinoco", profile_photo: "p.jpg", boost_tier: 0 }], error: null };
      };
      const q: Record<string, unknown> = {
        select(s: string) { call.select = s; return q; },
        eq(c: string, v: unknown) { call.filters.push(["eq", c, v]); return q; },
        in(c: string, v: unknown) { call.filters.push(["in", c, v]); return q; },
        order() { return q; },
        limit(n: number) { call.limit = n; return q; },
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
