import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { SMOKE_COOLDOWN_MS, SMOKE_FIXTURE_GOOGLE_PLACE_ID, smokeCooldownRefusal, startSmokeEnrich } from "./smoke-enrich.ts";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const ENV = { get: (name: string) => (name === "RENDER_KEY" ? "key" : undefined) };

// One fixture place. `enriching` and `updatedAt` are its places row.
function fakeAdmin(state: { exists: boolean; enriching: boolean; updatedAt: string | null }) {
  const builder = (table: string) => {
    const q = { op: "select", eqs: {} as Record<string, string>, neq: "", ids: [] as string[] };
    const resolve = () => {
      if (table === "place_profiles" && q.eqs.google_place_id !== undefined) {
        const hit = state.exists && q.eqs.google_place_id === SMOKE_FIXTURE_GOOGLE_PLACE_ID;
        return { data: hit ? { id: "fixture" } : null, error: null };
      }
      if (table === "place_profiles") {
        return {
          data: q.ids.map((id) => ({ id, google_place_id: SMOKE_FIXTURE_GOOGLE_PLACE_ID, name: "Orinoco", updated_at: null })),
          error: null,
        };
      }
      if (table === "places" && q.op === "update") {
        if (q.neq === "generating" && state.enriching) return { data: null, error: null };
        state.enriching = true;
        return { data: { id: q.eqs.id }, error: null };
      }
      if (table === "places") return { data: { updated_at: state.updatedAt }, error: null };
      return { data: null, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      update: () => ((q.op = "update"), b),
      in: (_c: string, ids: string[]) => ((q.ids = ids), b),
      eq: (c: string, v: string) => ((q.eqs[c] = v), b),
      neq: (_c: string, v: string) => ((q.neq = v), b),
      maybeSingle: () => Promise.resolve(resolve()),
      single: () => Promise.resolve(resolve()),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(resolve()).then(ok),
    };
    return b;
  };
  return { from: builder } as unknown as SupabaseClient;
}

function counter() {
  const calls: unknown[] = [];
  const fetchImpl = ((_u: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response("{}"));
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const LONG_AGO = new Date(NOW - 2 * SMOKE_COOLDOWN_MS).toISOString();

Deno.test("the cooldown holds for an hour after the fixture last changed", () => {
  assertEquals(smokeCooldownRefusal(LONG_AGO, NOW), null);
  assertEquals(smokeCooldownRefusal(null, NOW), null);
  assertEquals(typeof smokeCooldownRefusal(new Date(NOW - 5 * 60_000).toISOString(), NOW), "string");
});

Deno.test("a smoke call starts exactly one run on the fixture", async () => {
  const { calls, fetchImpl } = counter();
  const admin = fakeAdmin({ exists: true, enriching: false, updatedAt: LONG_AGO });
  const started = await startSmokeEnrich(admin, { now: NOW, env: ENV, fetchImpl });
  assertEquals(started, { ok: true, placeId: "fixture", task: "mesita-monorepo/enrich-single-place" });
  assertEquals(calls.length, 1);
});

Deno.test("a fixture already enriching is 409 and Render is not called", async () => {
  const { calls, fetchImpl } = counter();
  const admin = fakeAdmin({ exists: true, enriching: true, updatedAt: LONG_AGO });
  const started = await startSmokeEnrich(admin, { now: NOW, env: ENV, fetchImpl });
  assertEquals(started.ok ? 200 : started.status, 409);
  assertEquals(calls.length, 0);
});

Deno.test("a fixture changed within the hour is 429 and Render is not called", async () => {
  const { calls, fetchImpl } = counter();
  const admin = fakeAdmin({ exists: true, enriching: false, updatedAt: new Date(NOW - 60_000).toISOString() });
  const started = await startSmokeEnrich(admin, { now: NOW, env: ENV, fetchImpl });
  assertEquals(started.ok ? 200 : started.status, 429);
  assertEquals(calls.length, 0);
});

Deno.test("a missing fixture is 404: the smoke never creates a place", async () => {
  const { calls, fetchImpl } = counter();
  const admin = fakeAdmin({ exists: false, enriching: false, updatedAt: null });
  const started = await startSmokeEnrich(admin, { now: NOW, env: ENV, fetchImpl });
  assertEquals(started.ok ? 200 : started.status, 404);
  assertEquals(calls.length, 0);
});
