// MESITA-3688 — consumer-web-list-visits: whose tabs, which mode, what leaves.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { listVisits, VISITS_LIMIT } from "./list-visits.ts";
import { LIST_PART_COLUMNS } from "./tab.ts";

type Call = { table: string; select: string; filters: Array<[string, string, unknown]>; limit?: number };

const ME = "00000000-0000-4000-8000-000000000001";
const PLACE = "00000000-0000-4000-8000-0000000000aa";
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

function tab(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    place_id: PLACE,
    status: "paid",
    currency: "mxn",
    livemode: false,
    bill_cents: 30000,
    tip_cents: 0,
    ticket: `T${i}`,
    waiter_name: "Ana",
    paid_at: FUTURE,
    expires_at: FUTURE,
    created_at: FUTURE,
    // Columns a careless select would carry; the view must drop them.
    token_hash: "f".repeat(64),
    staff_key_hash: "e".repeat(64),
    consumer_id: ME,
    ...extra,
  };
}

/** A query builder that records each call and answers from `rows`. */
function stub(rows: { tabs: unknown[]; parts?: unknown[] | Error }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, select: "", filters: [] };
      calls.push(call);
      const answer = () => {
        if (table === "pay_tabs") return { data: rows.tabs.slice(0, call.limit ?? rows.tabs.length), error: null };
        if (table === "wallet_payments") {
          return rows.parts instanceof Error ? { data: null, error: { message: rows.parts.message } } : { data: rows.parts ?? [], error: null };
        }
        return { data: [{ id: PLACE, slug: "orinoco", name: "Orinoco", profile_photo: "p.jpg", boost_tier: 0 }], error: null };
      };
      const q: Record<string, unknown> = {
        select(s: string) { call.select = s; return q; },
        eq(c: string, v: unknown) { call.filters.push(["eq", c, v]); return q; },
        is(c: string, v: unknown) { call.filters.push(["is", c, v]); return q; },
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

Deno.test("a guest lists only their own tabs, in the wallet's money mode", async () => {
  const { client, calls } = stub({ tabs: [tab(1)] });
  await listVisits(client, ME, true, Date.now());
  const tabs = calls.find((c) => c.table === "pay_tabs")!;
  assertEquals(tabs.filters.filter((f) => f[0] === "eq"), [["eq", "consumer_id", ME], ["eq", "livemode", true]]);
  // MESITA-3695: a split table is listed as the guest's own share, never twice.
  assertEquals(tabs.filters.filter((f) => f[0] === "is"), [["is", "split_at", null]]);
});

Deno.test("nothing secret leaves: no hashes, proof tokens or consumer id", async () => {
  const { client, calls } = stub({ tabs: [tab(1)], parts: [{ id: "p1", tab_id: tab(1).id, status: "paid", paid_at: FUTURE, proof_token: "secret" }] });
  const res = await listVisits(client, ME, false, Date.now());
  assert(res.ok);
  const out = JSON.stringify(res);
  for (const word of ["token_hash", "staff_key_hash", "proof_token", "consumer_id", "secret"]) assert(!out.includes(word), word);
  assertEquals(calls.find((c) => c.table === "wallet_payments")!.select, LIST_PART_COLUMNS);
  assertEquals(res.visits[0].part_payment_ids, ["p1"]);
  assertEquals(res.visits[0].place, { id: PLACE, name: "Orinoco", slug: "orinoco", photo_url: "p.jpg" });
});

Deno.test("51 tabs come back as 50 and truncated", async () => {
  const { client } = stub({ tabs: Array.from({ length: VISITS_LIMIT + 1 }, (_, i) => tab(i + 1)) });
  const res = await listVisits(client, ME, false, Date.now());
  assert(res.ok);
  assertEquals([res.visits.length, res.truncated], [50, true]);
});

Deno.test("a failed parts read fails the whole call", async () => {
  const { client } = stub({ tabs: [tab(1)], parts: new Error("boom") });
  const res = await listVisits(client, ME, false, Date.now());
  assertEquals(res.ok ? null : res.error, "parts: boom");
});

Deno.test("an open tab past its time reads expired", async () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const { client } = stub({ tabs: [tab(1, { status: "billed", paid_at: null, expires_at: past })], parts: [] });
  const res = await listVisits(client, ME, false, Date.now());
  assertEquals(res.ok ? res.visits[0].status : null, "expired");
});

Deno.test("MESITA-3772: a guest's open payment is findable from any device (origin, verified_at)", async () => {
  const { client, calls } = stub({ tabs: [tab(1, { origin: "guest", verified_at: null, status: "paying" }), tab(2)] });
  const res = await listVisits(client, ME, false, Date.now());
  assert(res.ok);
  assert(calls.find((c) => c.table === "pay_tabs")!.select.includes("origin, verified_at"));
  assertEquals(res.visits.map((v) => [v.origin, v.verified_at, v.expires_at]), [["guest", null, FUTURE], ["waiter", null, FUTURE]]);
});
