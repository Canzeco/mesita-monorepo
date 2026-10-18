import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  mapLineupIntent,
  mapLineupWeights,
  reorderListedLanes,
} from "./nearby-lineup.ts";
import {
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
    openNow: null,
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
  // The fact travels on the row itself (`enriched_at`, selected by
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
  assertEquals(intent.families.includes("dinner"), true);
  assertEquals(intent.families.includes("coffee"), true);
  assertEquals(intent.families.includes("breakfast"), true);
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
  // MESITA-2288: the ladder high-water side-read is gone; `enriched` reads
  // the row's own `enriched_at`.
  assertEquals(googleBranch.includes("attachCrenupHighWater"), false);
  // Behavioural, not source-text: the old assertion pinned the literal
  // `searchPower >= 2` and was satisfiable by whatever the file happened to
  // say, so forgetting to update a second copy of that literal stayed green.
  // The Google call is gated on the CAP now, computed once from the scope.
  assertEquals(googleBranch.includes("wantGoogleNearby && googleForMerge.length > 0"), true);
  assertEquals(src.includes("lanes.googleCount > 0"), true);
  assertEquals(src.includes("searchPower >="), false);
  const listedOnly = src.slice(
    src.indexOf("if (!googleFill)"),
    src.indexOf("let googleHits"),
  );
  assertEquals(listedOnly.includes("reorderListedLanes"), false);
  assertEquals(listedOnly.includes("mergeNearbyCatalog"), true);
});

// MESITA-2154: a Google hit Mesita owns never goes out as a `g:` stub (its
// "Add to Mesita" 409s `place_already_exists`). The behaviour lives in
// claimOwnedHits / resolveGoogleItem (nearby-places.test.ts); this pins that
// the EF feeds them an UNFILTERED owned lookup and routes every Google item
// through them before googleStub.
Deno.test("list-places: owned gids come from an unfiltered lookup and gate every stub", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-list-places/index.ts", import.meta.url),
  );
  const googleBranch = src.slice(src.indexOf("let googleHits"));
  // The owned lookup is the first profiles read in the branch, and it
  // carries no cut: no discovery filters, no General gate, no guest floors.
  const ownedStart = googleBranch.indexOf("let ownedRows");
  const ownedEnd = googleBranch.indexOf("const ringOwnedGids");
  assertEquals(ownedStart > -1 && ownedEnd > ownedStart, true);
  const ownedLookup = googleBranch.slice(ownedStart, ownedEnd);
  assertEquals(ownedLookup.includes('.in("google_place_id", missing)'), true);
  for (const cut of [
    "applyDiscoveryFilters",
    "applyGeneralGateQuery",
    "google_review_count",
    "overlaps",
    "requireReady",
  ]) {
    assertEquals(ownedLookup.includes(cut), false, `owned lookup carries ${cut}`);
  }
  // The ring admission query keeps the operator's filters intact.
  assertEquals(src.includes("requireReady: false"), false);
  // The claim feeds the merge, and every Google item is resolved before
  // googleStub is reachable.
  assertEquals(googleBranch.includes("claimOwnedHits(googleHits, ownedRows, mesitaRows)"), true);
  assertEquals(googleBranch.includes("claim.hits.filter("), true);
  const resolveAt = googleBranch.indexOf("resolveGoogleItem(item.hit, claim)");
  const stubAt = googleBranch.indexOf("googleStub(");
  assertEquals(resolveAt > -1 && stubAt > resolveAt, true);
  assertEquals(googleBranch.indexOf("googleStub(", stubAt + 1), -1);
});
