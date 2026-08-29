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
    ...over,
  };
}

Deno.test("mergeNearbyCatalog stays distance-ordered — lineup is opt-in", () => {
  const close = {
    id: "listed-far-score",
    plan: "free",
    google_place_id: "ChIJ-close",
    lat: 25.67005,
    lng: -100.30005,
    category: "cafe",
    google_stars_overall: 3.1,
    google_review_count: 4,
  };
  const farther = {
    id: "listed-near-score",
    plan: "free",
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

Deno.test("a far partner outside takeClosest never enters", () => {
  const nearPartner = {
    id: "near-p",
    plan: "pro",
    google_place_id: "ChIJ-np",
    lat: 25.6701,
    lng: -100.3001,
  };
  const farPartner = {
    id: "far-p",
    plan: "pro",
    google_place_id: "ChIJ-fp",
    lat: 25.9,
    lng: -100.5,
  };
  const merged = mergeNearbyCatalog(
    [farPartner, nearPartner],
    [],
    CENTER,
    { mesitaCount: 1, googleCount: 0 },
  );
  const ids = merged.map((x) => x.kind === "listed" ? x.row.id : "");
  assertEquals(ids.includes("far-p"), false);
  assertEquals(ids.includes("near-p"), true);
  const reordered = reorderListedLanes(merged, {
    center: CENTER,
    weights: mapLineupWeights(DISCOVERY_DEFAULTS.weights),
    params: DISCOVERY_DEFAULTS.params,
  });
  assertEquals(
    reordered.map((x) => x.kind === "listed" ? x.row.id : ""),
    ids,
  );
});

Deno.test("a cafe never jumps a partner after Lineup", () => {
  const partner = {
    id: "partner",
    plan: "pro",
    google_place_id: "ChIJ-p",
    lat: 25.675,
    lng: -100.305,
    category: "restaurant",
    google_stars_overall: 3.2,
    google_review_count: 8,
  };
  const cafe = {
    id: "cafe",
    plan: "free",
    google_place_id: "ChIJ-c",
    lat: 25.67005,
    lng: -100.30005,
    category: "cafe",
    google_stars_overall: 4.9,
    google_review_count: 900,
  };
  const merged = mergeNearbyCatalog([cafe, partner], [], CENTER, LANES);
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: mapLineupWeights(DISCOVERY_DEFAULTS.weights),
    params: DISCOVERY_DEFAULTS.params,
    ...mapLineupIntent(["restaurant", "cafe"]),
  });
  assertEquals(
    out.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["partner", "cafe"],
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
    weights: mapLineupWeights(DISCOVERY_DEFAULTS.weights),
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
  assertEquals(mapLineupWeights(DISCOVERY_DEFAULTS.weights).randomness, 0);
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
      plan: "free",
      google_place_id: "ChIJ-a",
      lat: 25.6701,
      lng: -100.3001,
    },
    {
      id: "b",
      plan: "free",
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
    weights: mapLineupWeights(DISCOVERY_DEFAULTS.weights),
  });
  assertEquals(out, poisoned);
});

Deno.test("list-places googleFill reorders; lat/lng-only does not", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-list-places/index.ts", import.meta.url),
  );
  assertEquals(src.includes("reorderListedLanes"), true);
  assertEquals(src.includes("rankByBlend"), false);
  assertEquals(src.includes("discoveryRank"), false);
  assertEquals(src.includes("slotPromoted"), false);
  assertEquals(src.includes("name_embedding"), false);
  assertEquals(src.includes("embedding,"), false);
  const googleBranch = src.slice(src.indexOf("const admitted = admitMapCatalog("));
  assertEquals(googleBranch.includes("reorderListedLanes"), true);
  assertEquals(googleBranch.includes("searchPower >= 2 && googleForMerge.length > 0"), true);
  assertEquals(googleBranch.includes("dropKnownMesitaGoogleHits"), false);
  const listedOnly = src.slice(
    src.indexOf("if (!googleFill)"),
    src.indexOf("let googleHits"),
  );
  assertEquals(listedOnly.includes("reorderListedLanes"), false);
  assertEquals(listedOnly.includes("mergeNearbyCatalog"), true);
});

Deno.test("nearby-lineup imports rankByBlend, not discoveryRank", async () => {
  const src = await Deno.readTextFile(new URL("./nearby-lineup.ts", import.meta.url));
  assertEquals(src.includes("rankByBlend"), true);
  assertEquals(src.includes("discoveryRank"), false);
  assertEquals(src.includes("slotPromoted"), false);
});
