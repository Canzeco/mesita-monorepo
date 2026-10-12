import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  attachCrenupHighWater,
  DISCOVERY_EXTRA_COLUMNS,
  EARNED_LANE_COLUMNS,
  toLineupPlace,
  toSignalPlace,
} from "./discovery-place.ts";
import { PLACE_PUBLIC_COLUMNS } from "./place-columns.ts";
import { popularity } from "./discovery-signals.ts";

/** A row shaped the way `profiles` actually returns one. */
const ROW: Record<string, unknown> = {
  id: "p1",
  lat: 19.4326,
  lng: -99.1332,
  hours: { monday: [{ open: "09:00", close: "22:00" }] },
  category: "taqueria",
  family_keys: ["food"],
  // The Google-named columns — the whole point of the translation layer.
  google_stars_overall: 4.6,
  google_review_count: 900,
  embedding: "[0.1,0.2]",
  name_embedding: "[0.3,0.4]",
};

Deno.test("every column the signals read is actually selectable", () => {
  // The failure this guards is silent: rename or drop a column and Popularity
  // reads null forever, falls back to the prior, and scores the whole deck
  // identically while looking healthy. PLACE_PUBLIC_COLUMNS is what every
  // engine SELECTs, so the signals' columns must live in it — except the
  // embedding, which is deliberately outside the public projection and added
  // per-query.
  const selected = new Set(PLACE_PUBLIC_COLUMNS.split(",").map((c) => c.trim()));
  for (const col of EARNED_LANE_COLUMNS) {
    if (col === DISCOVERY_EXTRA_COLUMNS) continue;
    assert(selected.has(col), `a signal reads "${col}", which no engine selects`);
  }
  // And the embedding is genuinely NOT public — if it ever joins that list,
  // a 1536-float vector is riding on every consumer payload.
  assert(
    !selected.has(DISCOVERY_EXTRA_COLUMNS),
    "the embedding is in PLACE_PUBLIC_COLUMNS — it is now on every consumer payload",
  );
});

Deno.test("toSignalPlace maps Google's column names onto the signal contract", () => {
  const p = toSignalPlace(ROW);
  assertEquals(p.rating, 4.6);
  assertEquals(p.user_ratings_total, 900);
  assertEquals(p.lat, 19.4326);
  assertEquals(p.category, "taqueria");
  assertEquals(p.family_keys, ["food"]);
  assertEquals(p.embedding, "[0.1,0.2]");
});

Deno.test("a mapped row moves Popularity off the prior — the dead-signal guard", () => {
  // This is the assertion that would have caught reading `row.rating`, which
  // does not exist on `places`.
  const mapped = popularity(toSignalPlace(ROW));
  const bare = popularity(toSignalPlace({ ...ROW, google_stars_overall: null, google_review_count: null }));
  assert(
    mapped !== bare,
    "Popularity scored a rated place identically to an unrated one — the rating columns are not reaching the signal",
  );
  assert(mapped > bare, `a 4.6 across 900 reviews (${mapped}) should beat the prior (${bare})`);
});

Deno.test("toSignalPlace sets `enriched` explicitly, from enriched_at alone", () => {
  // MESITA-2154: `isEnrichedPlace` is a stamped enriched_at — an Enrich run
  // completed. Set HERE, once, so the signal never re-derives it.
  const STAMP = "2026-09-01T00:00:00Z";
  assertEquals(toSignalPlace({ ...ROW, content_state: "ready", enriched_at: STAMP }).enriched, true);
  assertEquals(
    toSignalPlace({ ...ROW, content_state: "generating", enriched_at: STAMP }).enriched,
    true,
    "a re-enrich in flight keeps an enriched place enriched",
  );
  // A Created place: Create saves ready and never stamps enriched_at.
  assertEquals(
    toSignalPlace({ ...ROW, content_state: "ready", enriched_at: null }).enriched,
    false,
  );
  assertEquals(toSignalPlace({ ...ROW, content_state: "ready" }).enriched, false);
  assertEquals(
    toSignalPlace({ ...ROW, content_state: "generating", enriched_at: null }).enriched,
    false,
  );
  // Never undefined: an absent fact is an answered "no", not a hole.
  assertEquals(toSignalPlace({}).enriched, false);
});

Deno.test("a synthesized Google row is never enriched, whatever else it carries", () => {
  // consumer-web-list-places builds a raw Google hit with `googleOnly: true`.
  // Gating the PROJECTION by name keeps it out of the enriched multiplier
  // even if a stub ever carried a stamp.
  assertEquals(
    toSignalPlace({ ...ROW, content_state: "ready", enriched_at: "2026-09-01T00:00:00Z", googleOnly: true })
      .enriched,
    false,
  );
  assertEquals(
    toLineupPlace({ ...ROW, content_state: "ready", googleOnly: true }).enriched,
    false,
  );
});

Deno.test("toLineupPlace adds nameEmbedding; toSignalPlace still omits it", () => {
  const earned = toSignalPlace(ROW) as unknown as Record<string, unknown>;
  assertEquals(earned.nameEmbedding, undefined);
  const lineup = toLineupPlace(ROW);
  assertEquals(lineup.nameEmbedding, "[0.3,0.4]");
  assertEquals(lineup.rating, 4.6);
  // And it inherits `enriched` through the spread — the earned fact travels
  // on both projections, unlike the name vector.
  assertEquals(
    toLineupPlace({ ...ROW, enriched_at: "2026-09-01T00:00:00Z" }).enriched,
    true,
  );
});

Deno.test("junk numbers degrade to null rather than poisoning a score", () => {
  const p = toSignalPlace({
    ...ROW,
    lat: "19.4",
    google_stars_overall: Number.NaN,
    google_review_count: Number.POSITIVE_INFINITY,
  });
  assertEquals(p.lat, null);
  assertEquals(p.rating, null);
  assertEquals(p.user_ratings_total, null);
});

// ── Crenup high-water fold (MESITA-1598) ────────────────────────────────────

Deno.test("toLineupPlace reads crenup_high_water like any other column; absent is null, not 0", () => {
  assertEquals(toLineupPlace(ROW).crenupHighWater, null);
  assertEquals(toLineupPlace({ ...ROW, crenup_high_water: 7 }).crenupHighWater, 7);
  assertEquals(toLineupPlace({ ...ROW, crenup_high_water: "nope" }).crenupHighWater, null);
});

function fakePlacesAdmin(
  rows: { id: string; enrichment: unknown }[],
  err: { message: string } | null = null,
): SupabaseClient {
  const chain = {
    select: () => chain,
    in: () => Promise.resolve({ data: err ? null : rows, error: err }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

Deno.test("attachCrenupHighWater: merges the pulse per row, absent id reads a real 0", async () => {
  const admin = fakePlacesAdmin([
    { id: "p1", enrichment: { highWater: 6 } },
    // "p2" is absent from the result — confirmed not found, not un-fetched.
  ]);
  const out = await attachCrenupHighWater(admin, [{ id: "p1" }, { id: "p2" }]);
  assertEquals(out[0].crenup_high_water, 6);
  assertEquals(out[1].crenup_high_water, 0);
});

Deno.test("attachCrenupHighWater: a query error leaves rows UNTOUCHED, never a confirmed 0", async () => {
  const admin = fakePlacesAdmin([], { message: "boom" });
  const rows = [{ id: "p1" }, { id: "p2" }];
  const out = await attachCrenupHighWater(admin, rows);
  // Same objects back, no `crenup_high_water` key added. No signal reads the
  // field today (MESITA-1858 collapsed the gradient into `enriched`); the
  // absence-vs-zero distinction is preserved for the deferred re-wire.
  assertEquals(out, rows);
  assert(!("crenup_high_water" in out[0]));
});

Deno.test("attachCrenupHighWater: a big band is read in ID_CHUNK slices, never one URL (MESITA-2047)", async () => {
  const lists: number[] = [];
  const chain = {
    select: () => chain,
    in: (_col: string, ids: string[]) => {
      lists.push(ids.length);
      return Promise.resolve({
        data: ids.map((id) => ({ id, enrichment: { highWater: 5 } })),
        error: null,
      });
    },
  };
  const admin = { from: () => chain } as unknown as SupabaseClient;
  const rows = Array.from({ length: 450 }, (_, i) => ({ id: `p${i}` }));
  const out = await attachCrenupHighWater(admin, rows);
  assertEquals(lists, [200, 200, 50]);
  assertEquals(out.every((r) => r.crenup_high_water === 5), true);
});

Deno.test("attachCrenupHighWater: one failed slice leaves every row UNTOUCHED", async () => {
  let call = 0;
  const chain = {
    select: () => chain,
    in: (_col: string, ids: string[]) =>
      Promise.resolve(
        call++ === 1
          ? { data: null, error: { message: "boom" } }
          : { data: ids.map((id) => ({ id, enrichment: { highWater: 5 } })), error: null },
      ),
  };
  const admin = { from: () => chain } as unknown as SupabaseClient;
  const rows = Array.from({ length: 450 }, (_, i) => ({ id: `p${i}` }));
  const out = await attachCrenupHighWater(admin, rows);
  assertEquals(out, rows);
});

Deno.test("attachCrenupHighWater: an empty pool or an id-less row set is a no-op, not a query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query for nothing to look up");
    },
  } as unknown as SupabaseClient;
  assertEquals(await attachCrenupHighWater(admin, []), []);
  const noIds = [{ name: "no id field" }];
  assertEquals(await attachCrenupHighWater(admin, noIds), noIds);
  assertEquals(queried, false);
});
