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
/** Merit order only. The bought lane gets its own tests at the bottom. */
const SLOT_OFF = { enabled: false, everyNth: 0 };
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
    slotting: SLOT_OFF,
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
    slotting: SLOT_OFF,
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

Deno.test("reorderListedLanes: intake_high_water (MESITA-1601) reorders when Level is weighted", () => {
  // Two partners (same plan, so moneyRung ties) at the same point — only
  // Intake high-water differs. This is the wiring consumer-web-list-places
  // provides via `attachIntakeHighWater` before calling `mergeNearbyCatalog`:
  // `reorderListedLanes` itself stays synchronous and unaware of the query.
  const hi = {
    id: "hi",
    plan: "pro",
    google_place_id: "ChIJ-hi",
    lat: 25.6701,
    lng: -100.3001,
    intake_high_water: 10,
  };
  const lo = {
    id: "lo",
    plan: "pro",
    google_place_id: "ChIJ-lo",
    lat: 25.6701,
    lng: -100.3001,
    intake_high_water: 0,
  };
  const merged = mergeNearbyCatalog([lo, hi], [], CENTER, LANES);
  const levelOnly = { ...mapLineupWeights(DISCOVERY_DEFAULTS.weights) };
  for (const key of Object.keys(levelOnly) as (keyof typeof levelOnly)[]) {
    levelOnly[key] = 0;
  }
  levelOnly.mesita_level = 4;
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: levelOnly,
    slotting: SLOT_OFF,
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
    weights: mapLineupWeights(DISCOVERY_DEFAULTS.weights),
    slotting: SLOT_OFF,
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
    slotting: SLOT_OFF,
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
  // Guest Popularity wraps admitMapCatalog, so the google-fill binding is
  // `mapped` (then `admitGuestMinReviews`). Listed-only still inlines it.
  const googleBranch = src.slice(src.indexOf("const mapped = admitMapCatalog("));
  assertEquals(googleBranch.includes("reorderListedLanes"), true);
  // MESITA-1601: Lineup scores mesita_level, which needs the Intake
  // high-water side-read merged onto the row before ranking — the branch
  // that actually calls `reorderListedLanes` must also call this.
  assertEquals(googleBranch.includes("attachIntakeHighWater"), true);
  // Behavioural, not source-text: the old assertion pinned the literal
  // `searchPower >= 2` and was satisfiable by whatever the file happened to
  // say, so forgetting to update a second copy of that literal stayed green.
  // The Google call is gated on the CAP now, and lanesForPlacesScope is the
  // one place that decides it.
  assertEquals(googleBranch.includes("wantGoogleNearby && googleForMerge.length > 0"), true);
  assertEquals(src.includes("lanes.googleCount > 0"), true);
  assertEquals(src.includes("searchPower >="), false);
  assertEquals(lanesForPlacesScope("mesita", 60).googleCount, 0);
  assertEquals(lanesForPlacesScope("partners", 60).googleCount, 0);
  assertEquals(lanesForPlacesScope("google", 60).googleCount > 0, true);
  assertEquals(googleBranch.includes("dropKnownMesitaGoogleHits"), false);
  const listedOnly = src.slice(
    src.indexOf("if (!googleFill)"),
    src.indexOf("let googleHits"),
  );
  assertEquals(listedOnly.includes("reorderListedLanes"), false);
  assertEquals(listedOnly.includes("mergeNearbyCatalog"), true);
});

// MESITA-1855 inverted this test. It used to assert nearby-lineup imports
// rankByBlend and NOT discoveryRank — written as an invariant, and it was
// really a record of the bought lane never having been wired. Three tests
// like it across two files were the reason `slotPromoted` sat with no
// production caller while the console kept storing `slotting`.
Deno.test("nearby-lineup runs the bought lane: discoveryRank, not rankByBlend", async () => {
  const src = await Deno.readTextFile(new URL("./nearby-lineup.ts", import.meta.url));
  assertEquals(src.includes("discoveryRank"), true);
  assertEquals(src.includes("rankByBlend"), false);
});

// The assertion that would have caught the original bug: lane 2 is reachable
// from something that is not a test. Source-text, because the alternative is
// trusting that somebody notices.
Deno.test("slotPromoted has a non-test caller", async () => {
  const dir = new URL("./", import.meta.url);
  let callers: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    if (entry.name === "discovery-blend.ts") continue; // where it is defined
    const src = await Deno.readTextFile(new URL(entry.name, dir));
    if (src.includes("discoveryRank")) callers.push(entry.name);
  }
  callers = callers.sort();
  assertEquals(callers, ["discovery-swipe.ts", "nearby-lineup.ts"]);
});


// ── The bought lane (MESITA-1855) ────────────────────────────────────────────
//
// PROMOTING IS A SUBSET OF PARTNER: `isPlacePromoting` returns false on any
// unpaid plan, so every promoting place is already in the partner lane and the
// non-partner lane's slotting pass can never fire. That is not a gap — it is
// why slotting per lane is safe here. The partner lane is where the question
// has an answer: among places that all pay, which of them also promotes.
//
// Every test below runs with ALL WEIGHTS ZERO. Under `Π s^w` that makes every
// place score exactly 1, so merit order is the incoming order and anything
// that moves was moved by the slotting pass. With Mesita Level on, a promoting
// partner already outranks a quiet one on merit and these assertions would
// pass without lane 2 running at all.

const NOW = new Date("2026-08-21T18:00:00Z");

const ZERO_WEIGHTS = Object.fromEntries(
  Object.keys(DISCOVERY_DEFAULTS.weights).map((k) => [k, 0]),
) as typeof DISCOVERY_DEFAULTS.weights;

const PROMO_RATES = {
  welcome_free_rate: 30,
  welcome_premium_rate: 50,
  free_rate: 10,
  premium_rate: 30,
  strike_count: 0,
  last_strike_at: null,
  promo_paused_until: null,
  plan_forfeited_at: null,
};

function pin(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    plan: "pro",
    google_place_id: `ChIJ-${id}`,
    lat: 25.6701,
    lng: -100.3001,
    category: "restaurant",
    google_stars_overall: 4.2,
    google_review_count: 40,
    ...over,
  };
}

const BIG_LANES: NearbyLaneCaps = { mesitaCount: 10, googleCount: 0 };

function listedIds(out: ReturnType<typeof reorderListedLanes>): string[] {
  return out.filter((x) => x.kind === "listed").map((x) =>
    x.kind === "listed" ? String(x.row.id) : ""
  );
}

Deno.test("slotting moves a promoting partner forward inside its lane", () => {
  // Four partners at one pin, all-zero weights: merit order is a, b, c, d.
  // `d` is the only one promoting. everyNth 2 makes position 2 a bought slot.
  const rows = [pin("a"), pin("b"), pin("c"), pin("d", PROMO_RATES)];
  const merged = mergeNearbyCatalog(rows, [], CENTER, BIG_LANES);
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: ZERO_WEIGHTS,
    slotting: { enabled: true, everyNth: 2 },
    params: DISCOVERY_DEFAULTS.params,
    now: NOW,
  });
  assertEquals(listedIds(out), ["a", "d", "b", "c"]);
});

Deno.test("only `enabled: false` serves merit order — everyNth 0 still slots", () => {
  // `enabled` is the off switch. everyNth is NOT: slotPromoted floors it at 2
  // so bought slots can never be every card, which means a 0 there slots at
  // every second position rather than disabling the lane. Pinned here as well
  // as in discovery-blend.test.ts because a caller reading `everyNth: 0` as
  // "off" is the plausible mistake, and it would quietly sell every other row.
  const rows = [pin("a"), pin("b"), pin("c"), pin("d", PROMO_RATES)];
  const merged = mergeNearbyCatalog(rows, [], CENTER, BIG_LANES);
  const base = {
    center: CENTER,
    weights: ZERO_WEIGHTS,
    params: DISCOVERY_DEFAULTS.params,
    now: NOW,
  };
  const off = reorderListedLanes(merged, { ...base, slotting: SLOT_OFF });
  assertEquals(listedIds(off), ["a", "b", "c", "d"]);

  const zero = reorderListedLanes(merged, {
    ...base,
    slotting: { enabled: true, everyNth: 0 },
  });
  assertEquals(listedIds(zero), ["a", "d", "b", "c"]);
});

Deno.test("a cafe never jumps a partner, however aggressive the slotting", () => {
  // The reason slotting runs per lane and not over the concatenation.
  const rows = [
    pin("cafe-1", { plan: "free" }),
    pin("cafe-2", { plan: "free" }),
    pin("partner-1"),
    pin("partner-2", PROMO_RATES),
  ];
  const merged = mergeNearbyCatalog(rows, [], CENTER, BIG_LANES);
  const out = reorderListedLanes(merged, {
    center: CENTER,
    weights: ZERO_WEIGHTS,
    slotting: { enabled: true, everyNth: 1 },
    params: DISCOVERY_DEFAULTS.params,
    now: NOW,
  });
  assertEquals(listedIds(out).slice(0, 2).sort(), ["partner-1", "partner-2"]);
});
