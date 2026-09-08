import { describe, expect, it } from "vitest";
import { intakeCalled } from "./MesitaSearchTab";
import type { PlaceHit } from "./actions";
import { INTAKE_FUNCTIONS } from "@/lib/state-vocabulary";

// A gap fixture (MESITA-1611): links (4) failed, social (5) and menu (7)
// later completed. The high-water stops counting at the first gap by
// design and reads 3 — the whole reason the honest per-function map exists.
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
  enrich_pulse: 3,
  enrich_pulse_total: 10,
  enrich_pulse_labels: [],
  enrich_pulse_blocked: { key: "links", index: 4, state: "failed" },
  enrich_functions: {
    pulse: { state: "completed", at: null, detail: null },
    details: { state: "completed", at: null, detail: null },
    serp: { state: "completed", at: null, detail: null },
    links: { state: "failed", at: null, detail: null },
    social: { state: "completed", at: null, detail: null },
    // images (6) never ran — absent from the map entirely.
    menu: { state: "completed", at: null, detail: null },
    reviews: { state: "pending", at: null, detail: null },
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
  const fn = INTAKE_FUNCTIONS.find((f) => f.key === key);
  if (!fn) throw new Error(`no INTAKE_FUNCTIONS entry for ${key}`);
  return fn;
}

describe("intakeCalled — the honest per-function map (MESITA-1611)", () => {
  it("shows Social and Menu as called even though the high-water stalled at 3", () => {
    expect(intakeCalled(GAP_FIXTURE, functionByKey("social"))).toBe(true);
    expect(intakeCalled(GAP_FIXTURE, functionByKey("menu"))).toBe(true);
  });

  it("still shows the failed function as called (it ran; it just failed)", () => {
    expect(intakeCalled(GAP_FIXTURE, functionByKey("links"))).toBe(true);
  });

  it("shows a function absent from the map, or explicitly pending, as not called", () => {
    expect(intakeCalled(GAP_FIXTURE, functionByKey("images"))).toBe(false);
    expect(intakeCalled(GAP_FIXTURE, functionByKey("reviews"))).toBe(false);
    expect(intakeCalled(GAP_FIXTURE, functionByKey("embedding"))).toBe(false);
  });

  it("reads Seed off `seeded`, never off the map or the high-water", () => {
    expect(intakeCalled(GAP_FIXTURE, functionByKey("seed"))).toBe(true);
    expect(
      intakeCalled({ ...GAP_FIXTURE, seeded: false }, functionByKey("seed")),
    ).toBe(false);
  });

  it("falls back to the high-water comparison when the payload predates the map", () => {
    const legacy: PlaceHit = { ...GAP_FIXTURE, enrich_functions: null };
    // High-water is 3: pulse/details/serp called, links and everything after not.
    expect(intakeCalled(legacy, functionByKey("serp"))).toBe(true);
    expect(intakeCalled(legacy, functionByKey("links"))).toBe(false);
    // The old bug this ticket exists to fix: with no map, a completed-after-
    // a-gap function reads as never-called.
    expect(intakeCalled(legacy, functionByKey("social"))).toBe(false);
    expect(intakeCalled(legacy, functionByKey("menu"))).toBe(false);
  });
});
