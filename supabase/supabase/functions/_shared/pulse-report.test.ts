// pulse-report.test.ts
//
// reportPulsePieces's event-log half is exercised end-to-end by every
// caller's own tests (enrich-pipeline.ts's reportEnrichmentStep is a thin,
// already-covered insert). These tests cover the NEW half (MESITA-1249):
// reportPulsePieces also merges the same outcomes into place_profiles.enrichment,
// read-merge-write, so admin-web-search-places/business-web-get-overview
// can read a live meter instead of re-deriving it from the event log.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { pieceDone, pieceFailed, reportPulsePieces } from "./pulse-report.ts";
import type { EnrichmentMap } from "./schema-catalog.ts";

/**
 * Mocks exactly the two tables reportPulsePieces's full call stack touches:
 * `place_enrichment_events` (the insert reportEnrichmentStep does, one per
 * stamped piece) and `place_profiles` (the read-merge-write mergeEnrichmentMap does,
 * once per call — through writePlace, which awaits `.update().eq()`
 * directly with no `.select()`, matching how mergeEnrichmentMap calls it).
 */
function fakeAdmin(initialEnrichment: EnrichmentMap | null): {
  admin: SupabaseClient;
  eventInserts: Record<string, unknown>[];
  placeUpdates: Record<string, unknown>[];
} {
  const eventInserts: Record<string, unknown>[] = [];
  const placeUpdates: Record<string, unknown>[] = [];
  let currentEnrichment = initialEnrichment;

  const admin = {
    from: (table: string) => {
      if (table === "place_enrichment_events") {
        return {
          insert: (value: Record<string, unknown>) => {
            eventInserts.push(value);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "place_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: currentEnrichment ? { enrichment: currentEnrichment } : null,
                  error: null,
                }),
            }),
          }),
          update: (value: Record<string, unknown>) => ({
            eq: () => {
              placeUpdates.push(value);
              if (value.enrichment) currentEnrichment = value.enrichment as EnrichmentMap;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`fakeAdmin: unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { admin, eventInserts, placeUpdates };
}

Deno.test("reportPulsePieces: a brand-new place's first stamp merges into an empty map", async () => {
  const { admin, placeUpdates } = fakeAdmin(null);
  await reportPulsePieces(admin, "place-1", {
    details: pieceDone("Google spine persisted; listing OPERATIONAL."),
  });
  assertEquals(placeUpdates.length, 1);
  const enrichment = placeUpdates[0].enrichment as EnrichmentMap;
  assertEquals(enrichment.highWater, 1);
  assertEquals(enrichment.blockedAt, { key: "serp", index: 2, state: "missing" });
  assertEquals(enrichment.functions.details?.state, "completed");
});

Deno.test("reportPulsePieces: a later stage's stamp PRESERVES an earlier stage's pieces (rule 3 — a piece a run didn't buy writes nothing)", async () => {
  const seeded: EnrichmentMap = {
    functions: { details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
    highWater: 1,
    blockedAt: { key: "serp", index: 2, state: "missing" },
  };
  const { admin, placeUpdates } = fakeAdmin(seeded);
  // A later stage stamps `serp` only — `details` is not in this call's
  // pieces at all, mirroring a real second-stage call.
  await reportPulsePieces(admin, "place-1", {
    serp: pieceDone("SERP Summary written."),
  });
  const enrichment = placeUpdates[0].enrichment as EnrichmentMap;
  assert(enrichment.functions.details, "details must still be there — this call never touched it");
  assertEquals(enrichment.functions.details?.state, "completed");
  assertEquals(enrichment.functions.serp?.state, "completed");
  assertEquals(enrichment.highWater, 2);
  assertEquals(enrichment.blockedAt, { key: "links", index: 3, state: "missing" });
});

Deno.test("reportPulsePieces: a failed piece lowers highWater and sets blockedAt, without touching later pieces already in the map", async () => {
  // A re-enrich that regresses: links previously completed, now fails.
  // serp must be seeded too — links (index 3) can only be reached past a
  // completed serp (index 2); a real run is strictly sequential.
  const seeded: EnrichmentMap = {
    functions: {
      details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
      serp: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
      links: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
    },
    highWater: 3, // stale relative to the seeded functions above — the merge recomputes it, not trusts it
    blockedAt: null,
  };
  const { admin, placeUpdates } = fakeAdmin(seeded);
  await reportPulsePieces(admin, "place-1", {
    links: pieceFailed("timeout"),
  });
  const enrichment = placeUpdates[0].enrichment as EnrichmentMap;
  assertEquals(enrichment.functions.links?.state, "failed");
  assertEquals(enrichment.highWater, 2, "the walk must stop at links (now failed) regardless of the stale seeded value");
  assertEquals(enrichment.blockedAt, { key: "links", index: 3, state: "failed" });
});

Deno.test("reportPulsePieces: Embedding at 8 cannot skip a gap", async () => {
  const seeded: EnrichmentMap = {
    functions: { details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
    highWater: 1,
    blockedAt: { key: "serp", index: 2, state: "missing" },
  };
  const { admin, placeUpdates } = fakeAdmin(seeded);
  await reportPulsePieces(admin, "place-1", {
    embedding: pieceDone("Mesita Name and Semantic Summary vectors written."),
  });
  const enrichment = placeUpdates[0].enrichment as EnrichmentMap;
  assertEquals(enrichment.functions.embedding?.state, "completed");
  assertEquals(enrichment.highWater, 1, "function 8 cannot skip 2–7");
});

Deno.test("mergeEnrichmentMap folds a legacy `semantic` — no degrade on the next stamp", async () => {
  // §8.4 v3 regression guard, now also a MESITA-2027 one: a pre-rename map
  // holds functions.semantic AND the two retired rungs (`pulse`, `menu`) at a
  // highWater of 10 under the old ten-rung ladder. Any later stamp (here: a
  // details refresh) must fold `semantic` into `embedding`, IGNORE the retired
  // keys, and recompute the number on today's eight — never trust the stored
  // 10 and never rewrite blocked-at.
  const legacy = [
    "pulse", "details", "serp", "links", "social",
    "images", "menu", "reviews", "description",
  ] as const;
  const functions: Record<string, { state: "completed"; at: string; detail: null }> = {};
  for (const k of legacy) functions[k] = { state: "completed", at: "2026-08-23T00:00:00Z", detail: null };
  functions.semantic = { state: "completed", at: "2026-08-23T00:00:00Z", detail: null };
  const seeded = {
    functions,
    highWater: 10,
    blockedAt: null,
  } as unknown as EnrichmentMap;
  const { admin, placeUpdates } = fakeAdmin(seeded);
  await reportPulsePieces(admin, "place-1", {
    details: pieceDone("refreshed"),
  });
  const enrichment = placeUpdates[0].enrichment as EnrichmentMap;
  // Every SURVIVING function completed, so the walk reaches the new top — 8,
  // not the stored 10. The retired keys neither advance it nor block it.
  assertEquals(enrichment.highWater, 8);
  assertEquals(enrichment.blockedAt, null);
  assertEquals(enrichment.functions.embedding?.state, "completed");
  assertEquals("semantic" in enrichment.functions, false);
});

Deno.test("reportPulsePieces: an unknown key is silently dropped, same as the event log — no place update at all if nothing else was stamped", async () => {
  const { admin, placeUpdates, eventInserts } = fakeAdmin(null);
  await reportPulsePieces(
    admin,
    "place-1",
    // deno-lint-ignore no-explicit-any
    { seed: pieceDone("not a real piece") } as any,
  );
  assertEquals(eventInserts.length, 0);
  assertEquals(placeUpdates.length, 0, "no piece was actually stamped, so the merge must not fire at all");
});
