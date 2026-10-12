import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  mapLineupIntent,
  mapLineupWeights,
  reorderListedLanes,
} from "./nearby-lineup.ts";
import {
  lanesForPlacesScope,
  mergeNearbyCatalog,
  type NearbyHit,
  type NearbyLaneCaps,
} from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };
const LANES: NearbyLaneCaps = {
  mesitaCount: 2,
  googleCount: 2,
};

function hit(over: Partial<NearbyHit> & Pick<NearbyHit, "placeId" | "name">): NearbyHit {
  return {
    address: "",
    lat: 25.6701,
    lng: -100.3001,
    rating: 4,
    primaryType: "restaurant",
    businessStatus: "OPERATIONAL",
    reviewCount: null,
    ...over,
  };
}

Deno.test("mergeNearbyCatalog stays distance-ordered — lineup is opt-in", () => {
  const close = {
    id: "listed-far-score",
    google_place_id: "ChIJ-close",
    lat: 25.67005,
    lng: -100.30005,
    category: "cafe",
    google_stars_overall: 3.1,
    google_review_count: 4,
  };
  const farther = {
    id: "listed-near-score",
    google_place_id: "ChIJ-far",
    lat: 25.672,
    lng: -100.302,
    category: "restaurant",
    google_stars_overall: 4.9,
    google_review_count: 800,
  };
  const merged = mergeNearbyCatalog([farther, close], [], CENTER, LANES);
  assertEquals(
    merged.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["listed-far-score", "listed-near-score"],
  );
});

Deno.test("a far place outside takeClosest never enters", () => {
  const near = {
    id: "near-p",
    google_place_id: "ChIJ-np",
    lat: 25.6701,
    lng: -100.3001,
  };
  const far = {
    id: "far-p",
    google_place_id: "ChIJ-fp",
    lat: 25.9,
    lng: -100.5,
  };
  const merged = mergeNearbyCatalog(
    [far, near],
    [],
    CENTER,
    { mesitaCount: 1, googleCount: 0 },
  );
  const ids = merged.map((x) => x.kind === "listed" ? x.row.id : "");
  assertEquals(ids.includes("far-p"), false);
  assertEquals(ids.includes("near-p"), true);
  const reordered = reorderListedLanes(merged, {
    center: CENTER,
    weights: mapLineupWeights(DISCOVERY_DEFAULTS),
    params: DISCOVERY_DEFAULTS.params,
  });
  assertEquals(
    reordered.map((x) => x.kind === "listed" ? x.row.id : ""),
    ids,
  );
});

Deno.test("reorderListedLanes: the enrichment fact reorders when Enriched is weighted", () => {
  // REPLACES "crenup_high_water (MESITA-1601) reorders when Level is
  // weighted". The gradient collapsed to a binary at MESITA-1858, so the
  // high-water numbers no longer move anything — but the DIRECTION they
  // encoded still has to reach the ranker, and that is what this pins. The
  // fact now travels on the row itself (`enriched_at`, selected by
  // EARNED_LANE_COLUMNS), not on a side-read. MESITA-2154: `lo` is a Created
  // place — content_state ready, no stamp — and is NOT enriched.
  const hi = {
    id: "hi",
    google_place_id: "ChIJ-hi",
    lat: 25.6701,
    lng: -100.3001,
    content_state: "ready",
    enriched_at: "2026-09-01T00:00:00Z",
  };
  const lo = {
    id: "lo",
    google_place_id: "ChIJ-lo",
    lat: 25.6701,
    lng: -100.3001,
    content_state: "ready",
    enriched_at: null,
  };
  const merged = mergeNearbyCatalog([lo, hi], [], CENTER, LANES);
  const enrichedOnly = { ...mapLineupWeights(DISCOVERY_DEFAULTS) };
  for (const key of Object.keys(enrichedOnly) as (keyof typeof enrichedOnly)[]) {
    enrichedOnly[key] = 0;
  }
  enrichedOnly.enriched = 2;
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: enrichedOnly,
    params: DISCOVERY_DEFAULTS.params,
  });
  assertEquals(
    out.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["hi", "lo"],
  );
});

Deno.test("Google lane stays distance order", () => {
  const google = [
    hit({ placeId: "g-near", name: "Near", lat: 25.6701, lng: -100.3001 }),
    hit({ placeId: "g-far", name: "Far", lat: 25.672, lng: -100.302 }),
  ];
  const merged = mergeNearbyCatalog([], google, CENTER, LANES);
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: mapLineupWeights(DISCOVERY_DEFAULTS),
    params: DISCOVERY_DEFAULTS.params,
  });
  assertEquals(
    out.filter((x) => x.kind === "google").map((x) =>
      x.kind === "google" ? x.hit.placeId : ""
    ),
    ["g-near", "g-far"],
  );
});

Deno.test("Map mask zeros randomness against the blob default", () => {
  assertEquals(mapLineupWeights(DISCOVERY_DEFAULTS).randomness, 0);
  assertEquals(DISCOVERY_DEFAULTS.weights.randomness, 0.35);
});

Deno.test("Category intent is enabled types plus their families", () => {
  const intent = mapLineupIntent(["restaurant", "cafe"]);
  assertEquals(intent.categories, ["restaurant", "cafe"]);
  assertEquals(intent.families.includes("restaurants"), true);
  assertEquals(intent.families.includes("cafes_bakeries"), true);
});

Deno.test("throw during blend returns the closest-N merge order", () => {
  const rows = [
    {
      id: "a",
      google_place_id: "ChIJ-a",
      lat: 25.6701,
      lng: -100.3001,
    },
    {
      id: "b",
      google_place_id: "ChIJ-b",
      lat: 25.6702,
      lng: -100.3002,
    },
  ];
  const merged = mergeNearbyCatalog(rows, [], CENTER, LANES);
  const bad = {
    ...merged[0],
    row: new Proxy(merged[0].kind === "listed" ? merged[0].row : rows[0], {
      get() {
        throw new Error("boom");
      },
    }),
  };
  const poisoned = [bad, ...merged.slice(1)];
  const out = reorderListedLanes(poisoned, {
    center: CENTER,
    weights: mapLineupWeights(DISCOVERY_DEFAULTS),
  });
  assertEquals(out, poisoned);
});

Deno.test("list-places googleFill reorders; lat/lng-only does not", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-list-places/index.ts", import.meta.url),
  );
  assertEquals(src.includes("reorderListedLanes"), true);
  assertEquals(src.includes("rankByBlend"), false);
  assertEquals(src.includes("name_embedding"), false);
  assertEquals(src.includes("embedding,"), false);
  // Guest Popularity wraps admitMapCatalog, so the google-fill binding is
  // `mapped` (then `admitGuestMinReviews`). Listed-only still inlines it.
  const googleBranch = src.slice(src.indexOf("const mapped = admitMapCatalog("));
  assertEquals(googleBranch.includes("reorderListedLanes"), true);
  // MESITA-1601, retained with no live reader (MESITA-1858): the branch that
  // calls `reorderListedLanes` must also call the high-water side-read. No
  // signal reads it today — the gradient collapsed into the `enriched`
  // binary — and it stays wired so restoring the gradient is a re-wire.
  assertEquals(googleBranch.includes("attachCrenupHighWater"), true);
  // Behavioural, not source-text: the old assertion pinned the literal
  // `searchPower >= 2` and was satisfiable by whatever the file happened to
  // say, so forgetting to update a second copy of that literal stayed green.
  // The Google call is gated on the CAP now, and lanesForPlacesScope is the
  // one place that decides it.
  assertEquals(googleBranch.includes("wantGoogleNearby && googleForMerge.length > 0"), true);
  assertEquals(src.includes("lanes.googleCount > 0"), true);
  assertEquals(src.includes("searchPower >="), false);
  assertEquals(lanesForPlacesScope("mesita", 60).googleCount, 0);
  assertEquals(lanesForPlacesScope("google", 60).googleCount > 0, true);
  const listedOnly = src.slice(
    src.indexOf("if (!googleFill)"),
    src.indexOf("let googleHits"),
  );
  assertEquals(listedOnly.includes("reorderListedLanes"), false);
  assertEquals(listedOnly.includes("mergeNearbyCatalog"), true);
});
