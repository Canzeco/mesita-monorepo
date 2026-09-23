import { describe, expect, it } from "vitest";
import { crenupCalled } from "./mesita-search-facts";
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
  content_state: "ready",
  listing_type: null,
  google_place_id: "ChIJ123",
  seeded: true,
  listed: true,
  requested: false,
  request_count: 0,
  enriching: false,
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
  verified: false,
  partner: false,
  promoting: false,
  promoting_level: 0,
  mesita_pay: false,
  credits: false,
  pickup: false,
  delivery: false,
  promotion: 0,
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
