import { describe, expect, it } from "vitest";
import { crenupCalled, factOn } from "./mesita-search-facts";
import type { PlaceHit } from "./actions";
import { CRENUP_STEPS } from "@/lib/state-vocabulary";

// A gap fixture (MESITA-1611): links (3) failed, social (4) and images (6)
// later completed. The high-water stops counting at the first gap by
// design and reads 2 — the whole reason the honest per-step map exists.
const GAP_FIXTURE: PlaceHit = {
  id: "p1",
  slug: "p1",
  name: "Casa Luminar",
  google_name: "Casa Luminar",
  category: null,
  category_label: null,
  state: "active",
  address: null,
  photo: null,
  zone: null,
  google_stars_overall: null,
  google_review_count: null,
  google_found: false,
  instagram_found: false,
  facebook_found: false,
  content_state: "ready",
  google_place_id: "ChIJ123",
  seeded: true,
  listed: true,
  requested: false,
  request_count: 0,
  enriching: false,
  enriched: false,
  enriched_at: null,
  business_state: "OPERATIONAL",
  business_state_at: null,
  enrich_crenup: 2,
  enrich_crenup_total: 8,
  enrich_crenup_labels: [],
  enrich_crenup_blocked: { key: "links", index: 3, state: "failed" },
  enrich_functions: {
    details: { state: "completed", at: null, detail: null },
    serp: { state: "completed", at: null, detail: null },
    links: { state: "failed", at: null, detail: null },
    social: { state: "completed", at: null, detail: null },
    // reviews (5) never ran — absent from the map entirely.
    images: { state: "completed", at: null, detail: null },
    description: { state: "pending", at: null, detail: null },
    embedding: { state: "pending", at: null, detail: null },
  },
};

function functionByKey(key: string) {
  const fn = CRENUP_STEPS.find((f) => f.key === key);
  if (!fn) throw new Error(`no CRENUP_STEPS entry for ${key}`);
  return fn;
}

describe("crenupCalled — the honest per-step map (MESITA-1611)", () => {
  it("shows Social and Images as called even though the high-water stalled at 2", () => {
    expect(crenupCalled(GAP_FIXTURE, functionByKey("social"))).toBe(true);
    expect(crenupCalled(GAP_FIXTURE, functionByKey("images"))).toBe(true);
  });

  it("still shows the failed step as called (it ran; it just failed)", () => {
    expect(crenupCalled(GAP_FIXTURE, functionByKey("links"))).toBe(true);
  });

  it("shows a step absent from the map, or explicitly pending, as not called", () => {
    expect(crenupCalled(GAP_FIXTURE, functionByKey("reviews"))).toBe(false);
    expect(crenupCalled(GAP_FIXTURE, functionByKey("description"))).toBe(false);
    expect(crenupCalled(GAP_FIXTURE, functionByKey("embedding"))).toBe(false);
  });

  it("reads Seed off `seeded`, never off the map or the high-water", () => {
    expect(crenupCalled(GAP_FIXTURE, functionByKey("seed"))).toBe(true);
    expect(
      crenupCalled({ ...GAP_FIXTURE, seeded: false }, functionByKey("seed")),
    ).toBe(false);
  });

  it("falls back to the high-water comparison when the payload predates the map", () => {
    const legacy: PlaceHit = { ...GAP_FIXTURE, enrich_functions: null };
    // High-water is 2: details/serp called, links and everything after not.
    expect(crenupCalled(legacy, functionByKey("serp"))).toBe(true);
    expect(crenupCalled(legacy, functionByKey("links"))).toBe(false);
    // The old bug this ticket exists to fix: with no map, a completed-after-
    // a-gap step reads as never-called.
    expect(crenupCalled(legacy, functionByKey("social"))).toBe(false);
    expect(crenupCalled(legacy, functionByKey("images"))).toBe(false);
  });
});

describe("factOn enriched — an Enrich run completed (MESITA-2154)", () => {
  it("reads a Created place (ready, no enriched_at) as NOT enriched", () => {
    const created: PlaceHit = {
      ...GAP_FIXTURE,
      content_state: "ready",
      enriched: false,
      enriched_at: null,
      enrich_crenup: 1,
      enrich_crenup_blocked: { key: "serp", index: 2, state: "missing" },
      enrich_functions: null,
    };
    expect(factOn(created, "enriched")).toBe(false);
  });

  it("reads enriched_at set as enriched, whatever the high-water says", () => {
    const enriched: PlaceHit = {
      ...GAP_FIXTURE,
      enriched: true,
      enriched_at: "2026-10-01T00:00:00Z",
    };
    // High-water 2 (a gap at links) — still Enriched: the meter is
    // completeness, not the yes/no.
    expect(factOn(enriched, "enriched")).toBe(true);
    // And a full high-water without a completed run is not Enriched.
    expect(
      factOn({ ...GAP_FIXTURE, enrich_crenup: 8, enriched: false }, "enriched"),
    ).toBe(false);
  });
});
