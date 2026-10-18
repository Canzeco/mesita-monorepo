import { assert, assertEquals } from "jsr:@std/assert@1";
import { __resetNearbyGoogleCacheForTests } from "./nearby-places.ts";
import {
  type AreaPoolDeps,
  areaFanoutCircles,
  FEED_GOOGLE_TYPES,
  googleCallsForStop,
  type OwnedRow,
  ownedCandidate,
  parseAreaBounds,
  resolveAreaLocation,
  selectAreaPool,
  selectedPoolQuery,
  selectMesitaSelected,
  snapCenter,
} from "./area-pipeline.ts";
import { nearbyExcludedTypesForFamilies } from "./sourcing.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

type GPlace = {
  id: string;
  lat: number;
  openNow?: boolean;
  status?: string;
  photo?: string;
  rating?: number;
  reviews?: number;
  type?: string;
};

function gPlace(p: GPlace) {
  return {
    id: `places/${p.id}`,
    displayName: { text: p.id },
    formattedAddress: "",
    location: { latitude: p.lat, longitude: CENTER.lng },
    rating: p.rating ?? 4.5,
    userRatingCount: p.reviews ?? 150,
    businessStatus: p.status ?? "OPERATIONAL",
    primaryType: p.type ?? "restaurant",
    ...(p.openNow === undefined
      ? {}
      : { currentOpeningHours: { openNow: p.openNow } }),
    ...(p.photo
      ? { photos: [{ name: `places/${p.id}/photos/${p.photo}` }] }
      : {}),
  };
}

type Call = { url: string; mask: string | null; body: string | null };

/** Stubs Google: Nearby answers `places` (or `status`), photo media answers a URI. */
function stubGoogle(
  places: GPlace[],
  nearbyStatus = 200,
): { calls: Call[]; restore: () => void } {
  const calls: Call[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      mask: headers.get("X-Goog-FieldMask"),
      body: typeof init?.body === "string" ? init.body : null,
    });
    if (url.includes("places:searchNearby")) {
      if (nearbyStatus !== 200) {
        return Promise.resolve(new Response("boom", { status: nearbyStatus }));
      }
      return Promise.resolve(
        Response.json({ places: places.map(gPlace) }),
      );
    }
    if (url.includes("/media?")) {
      const name = url.split("/v1/")[1].split("/media")[0];
      return Promise.resolve(Response.json({
        photoUri: `https://lh3.googleusercontent.com/${name}`,
      }));
    }
    return Promise.resolve(new Response("unexpected", { status: 500 }));
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = orig) };
}

function reset() {
  __resetNearbyGoogleCacheForTests();
}

type DepsOver = Partial<AreaPoolDeps<OwnedRow>> & {
  /** Shorthands for a point location around CENTER. */
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
};

function deps(over: DepsOver = {}) {
  let quotaCalls = 0;
  const lookups: string[][] = [];
  const { center = CENTER, radiusKm = 50, ...rest } = over;
  const d: AreaPoolDeps<OwnedRow> = {
    apiKey: "k",
    location: center ? { kind: "point", anchor: center, radiusKm } : { kind: "none" },
    families: [],
    types: FEED_GOOGLE_TYPES,
    googleCalls: 1,
    mesitaLimit: 20,
    mesitaRows: [],
    cfg: DISCOVERY_DEFAULTS,
    consumeQuota: () => {
      quotaCalls++;
      return Promise.resolve(true);
    },
    lookupOwned: (gids: string[]) => {
      lookups.push(gids);
      return Promise.resolve([] as OwnedRow[]);
    },
    ...rest,
  };
  return { d, quota: () => quotaCalls, lookups };
}

const nearbyCalls = (calls: Call[]) =>
  calls.filter((c) => c.url.includes("places:searchNearby"));
const ids = (places: Array<Record<string, unknown>>) =>
  places.map((p) => p.id);

Deno.test("google: ONE Nearby call inside the operator's radius, mask with openNow, no photo", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.671 }]);
  try {
    const { d } = deps({ radiusKm: 12.5 });
    await selectAreaPool(d);
    const calls = nearbyCalls(g.calls);
    assertEquals(calls.length, 1);
    assert(calls[0].mask!.includes("places.currentOpeningHours.openNow"));
    assertEquals(calls[0].mask!.includes("photos"), false);
    const sent = JSON.parse(calls[0].body!);
    assertEquals(sent.maxResultCount, 20);
    assertEquals(sent.rankPreference, "DISTANCE");
    assertEquals(sent.locationRestriction.circle.radius, 12_500);
    assertEquals(g.calls.filter((c) => c.url.includes("/media?")).length, 0);
  } finally {
    g.restore();
  }
});

Deno.test("google: the operator's review minimum cuts after Google answers, never a refill", async () => {
  reset();
  const g = stubGoogle([
    { id: "thin", lat: 25.6701, reviews: 12 },
    { id: "loved", lat: 25.672, reviews: 900 },
  ]);
  try {
    const cfg = { ...DISCOVERY_DEFAULTS, map: { ...DISCOVERY_DEFAULTS.map, googleMinReviews: 100 } };
    const { d } = deps({ cfg });
    const out = await selectAreaPool(d);
    assertEquals(ids(out.places), ["g:loved"]);
    assertEquals(nearbyCalls(g.calls).length, 1);
  } finally {
    g.restore();
  }
});

Deno.test("google: General gate drops a closed business", async () => {
  reset();
  const g = stubGoogle([
    { id: "gone", lat: 25.6701, status: "CLOSED_PERMANENTLY" },
    { id: "live", lat: 25.672 },
  ]);
  try {
    const out = await selectAreaPool(deps().d);
    assertEquals(ids(out.places), ["g:live"]);
  } finally {
    g.restore();
  }
});

Deno.test("google: a hit Mesita owns goes out as that row, once (dedup by gid)", async () => {
  reset();
  const g = stubGoogle([
    { id: "mine", lat: 25.6701 },
    { id: "theirs", lat: 25.672 },
  ]);
  try {
    const owned: OwnedRow = {
      id: "mesita-1",
      google_place_id: "mine",
      lat: 25.6701,
      lng: CENTER.lng,
      enriched_at: "2026-01-01T00:00:00Z",
      content_state: "ready",
    };
    const { d, lookups } = deps({
      lookupOwned: (gids) => {
        lookups.push(gids);
        return Promise.resolve([owned, { ...owned, id: "dupe" }]);
      },
    });
    const out = await selectAreaPool(d);
    assertEquals(new Set(ids(out.places)), new Set(["mesita-1", "g:theirs"]));
    assertEquals(lookups.length, 1);
    const mesita = out.places.find((p) => p.id === "mesita-1")!;
    assertEquals("google_place_id" in mesita, false);
  } finally {
    g.restore();
  }
});

Deno.test("google: the Area score is proximity × popularity; distance breaks ties", async () => {
  reset();
  // near-quiet: proximity ≈ 1 × popularity ln(331)/ln(4501) ≈ 0.69.
  // far-loved (1.1 km): proximity 2^(−1.11/4.1) ≈ 0.83 × popularity 1.
  const g = stubGoogle([
    { id: "near-quiet", lat: 25.6701, rating: 3.0, reviews: 110 },
    { id: "far-loved", lat: 25.68, rating: 4.9, reviews: 5000 },
  ]);
  try {
    const out = await selectAreaPool(deps().d);
    assertEquals(ids(out.places), ["g:far-loved", "g:near-quiet"]);
  } finally {
    g.restore();
  }
  reset();
  const tie = stubGoogle([
    { id: "far", lat: 25.6705 },
    { id: "near", lat: 25.6702 },
  ]);
  try {
    const out = await selectAreaPool(deps().d);
    assertEquals(ids(out.places), ["g:near", "g:far"]);
  } finally {
    tie.restore();
  }
});

Deno.test("google: open now no longer reorders (Area reads Proximity and Popularity only)", async () => {
  reset();
  const g = stubGoogle([
    { id: "closed-near", lat: 25.6701, openNow: false },
    { id: "open-far", lat: 25.6702, openNow: true },
  ]);
  try {
    const out = await selectAreaPool(deps().d);
    assertEquals(ids(out.places), ["g:closed-near", "g:open-far"]);
  } finally {
    g.restore();
  }
});

Deno.test("google: the Family gate drops a hit outside the requested families", async () => {
  reset();
  const g = stubGoogle([{ id: "a-restaurant", lat: 25.6701 }]);
  try {
    const out = await selectAreaPool(deps({ families: ["coffee"] }).d);
    assertEquals(out.places, []);
    const all = await selectAreaPool(deps({ families: [] }).d);
    assertEquals(ids(all.places), ["g:a-restaurant"]);
  } finally {
    g.restore();
  }
});

Deno.test("google: the pool is not cut to a rail — every eligible hit comes back, ranked", async () => {
  reset();
  const g = stubGoogle(
    Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, lat: 25.6701 + i / 1e4 })),
  );
  try {
    const out = await selectAreaPool(deps().d);
    assertEquals(out.places.length, 12);
    assertEquals(out.summary.returned, 12);
  } finally {
    g.restore();
  }
});

Deno.test("google: no key, no centre or no types makes no call and returns nothing", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    for (const over of [{ apiKey: null }, { center: null }, { types: [] }]) {
      const { d, quota } = deps(over);
      const out = await selectAreaPool(d);
      assertEquals(out.places, []);
      assertEquals(quota(), 0);
    }
    assertEquals(nearbyCalls(g.calls).length, 0);
  } finally {
    g.restore();
  }
});

Deno.test("google: a quota refusal is empty — never Mesita rows under the Google label", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    const { d, lookups } = deps({ consumeQuota: () => Promise.resolve(false) });
    const out = await selectAreaPool(d);
    assertEquals(out.places, []);
    assertEquals(nearbyCalls(g.calls).length, 0);
    assertEquals(lookups.length, 0);
  } finally {
    g.restore();
  }
});

Deno.test("google: a Google error is empty and not cached", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }], 500);
  try {
    assertEquals((await selectAreaPool(deps().d)).places, []);
  } finally {
    g.restore();
  }
  const ok = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    assertEquals(ids((await selectAreaPool(deps().d)).places), ["g:a"]);
    assertEquals(nearbyCalls(ok.calls).length, 1);
  } finally {
    ok.restore();
  }
});

Deno.test("google: an owned-row lookup error fails closed (no stub may shadow a Mesita place)", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    const out = await selectAreaPool(
      deps({ lookupOwned: () => Promise.resolve(null) }).d,
    );
    assertEquals(out.places, []);
  } finally {
    g.restore();
  }
});

Deno.test("google: a warm cell makes no Google call and spends no quota", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    await selectAreaPool(deps().d);
    const second = deps();
    const out = await selectAreaPool(second.d);
    assertEquals(ids(out.places), ["g:a"]);
    assertEquals(nearbyCalls(g.calls).length, 1);
    assertEquals(second.quota(), 0);
  } finally {
    g.restore();
  }
});

// ── Mesita Selected ─────────────────────────────────────────────────────

const ENRICHED = "2026-01-01T00:00:00Z";
function mrow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    lat: CENTER.lat,
    lng: CENTER.lng,
    enriched_at: ENRICHED,
    content_state: "ready",
    family_keys: ["dinner"],
    category: "restaurant",
    google_stars_overall: 4.4,
    google_review_count: 120,
    ...over,
  };
}
const selOpts = {
  center: CENTER,
  radiusKm: 10,
  params: DISCOVERY_DEFAULTS.params,
};

Deno.test("selected: only enriched, ready rows inside the radius", () => {
  const out = selectMesitaSelected([
    mrow("ok"),
    mrow("created", { enriched_at: null }),
    mrow("generating", { content_state: "generating" }),
    mrow("far", { lat: CENTER.lat + 1 }),
  ], selOpts);
  assertEquals(ids(out), ["ok"]);
});

Deno.test("selected: has no review floor — a two-review place is kept", () => {
  const out = selectMesitaSelected([
    mrow("thin", { google_review_count: 2 }),
  ], selOpts);
  assertEquals(ids(out), ["thin"]);
});

Deno.test("selected: the Area score ranks; the nearer twin first", () => {
  const out = selectMesitaSelected([
    mrow("far-twin", { lat: CENTER.lat + 0.02 }),
    mrow("near-twin", { lat: CENTER.lat + 0.001 }),
  ], selOpts);
  assertEquals(ids(out), ["near-twin", "far-twin"]);
  // quiet at 0 km: (1 × 5 + 0.03 × 5) ÷ 10 ≈ 0.51; loved at 1.1 km on a
  // 10 km radius: (0.89 × 5 + 0.95 × 5) ÷ 10 ≈ 0.92.
  const loved = selectMesitaSelected([
    mrow("quiet", { google_stars_overall: 3.1, google_review_count: 5 }),
    mrow("loved", {
      lat: CENTER.lat + 0.01,
      google_stars_overall: 4.9,
      google_review_count: 3000,
    }),
  ], selOpts);
  assertEquals(ids(loved), ["loved", "quiet"]);
});

Deno.test("selected: the weights are the operator's (params.balance), MESITA-2347", () => {
  const rows = [
    mrow("near-quiet", { lat: CENTER.lat + 0.001, google_stars_overall: 4.0, google_review_count: 100 }),
    mrow("far-loved", { lat: CENTER.lat + 0.05, google_stars_overall: 4.9, google_review_count: 4000 }),
  ];
  const distance = {
    ...selOpts,
    params: { ...selOpts.params, balance: { proximity: 10, popularity: 0 } },
  };
  const proven = {
    ...selOpts,
    params: { ...selOpts.params, balance: { proximity: 0, popularity: 10 } },
  };
  assertEquals(ids(selectMesitaSelected(rows, distance))[0], "near-quiet");
  assertEquals(ids(selectMesitaSelected(rows, proven))[0], "far-loved");
});

Deno.test("selected: Proximity reads the radius, so the same place scores differently on a wider circle", () => {
  // 5.6 km north: 0 on a 5.6 km radius's edge… but inside only on a wider one.
  const row = mrow("mid", { lat: CENTER.lat + 0.05 });
  const narrow = selectMesitaSelected([row], { ...selOpts, radiusKm: 6 });
  const wide = selectMesitaSelected([row], { ...selOpts, radiusKm: 60 });
  assertEquals(ids(narrow), ["mid"]);
  assertEquals(ids(wide), ["mid"]);
});

Deno.test("selected: guest families cut, and no centre means no radius", () => {
  const rows = [
    mrow("coffee", { family_keys: ["coffee"], category: "cafe" }),
    mrow("dinner", { lat: CENTER.lat + 5 }),
  ];
  assertEquals(
    ids(selectMesitaSelected(rows, { ...selOpts, families: ["coffee"] })),
    ["coffee"],
  );
  assertEquals(
    new Set(ids(selectMesitaSelected(rows, { ...selOpts, center: null }))),
    new Set(["coffee", "dinner"]),
  );
});

Deno.test("selectedPoolQuery: Enriched gate, General, ready, families and the radius box", () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  selectedPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
    families: ["coffee"],
  });
  assert(seen.includes("not enriched_at is null"));
  assert(seen.includes("eq content_state ready"));
  assert(seen.includes("overlaps family_keys coffee"));
  assert(seen.some((s) => s.startsWith("gte lat")));
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
  // A capped pool is the same slice every time (MESITA-2338).
  assertEquals(seen[seen.length - 1], "order id true");
});

Deno.test("google: the operator's floor alone cuts Google hits; no guest stop (MESITA-2319, MESITA-2417)", async () => {
  reset();
  const g = stubGoogle([
    { id: "thin", lat: 25.6701, reviews: 150 },
    { id: "loved", lat: 25.672, reviews: 900 },
  ]);
  try {
    const cfg = { ...DISCOVERY_DEFAULTS, map: { ...DISCOVERY_DEFAULTS.map, googleMinReviews: 500 } };
    const out = await selectAreaPool(deps({ cfg }).d);
    assertEquals(ids(out.places), ["g:loved"]);
  } finally {
    g.restore();
  }
});

Deno.test("selected: the operator's Google floor never touches Mesita Selected", () => {
  const out = selectMesitaSelected([mrow("thin", { google_review_count: 2 })], selOpts);
  assertEquals(ids(out), ["thin"]);
});

Deno.test("Area keeps only General's active check: the Name pipeline's reviews floor never cuts it", async () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  const general = { ...DISCOVERY_DEFAULTS.general, minReviews: 500 };
  selectedPoolQuery(q, { general }, { center: null, radiusKm: 5 });
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
  reset();
  const g = stubGoogle([{ id: "thin", lat: 25.6701, reviews: 12 }]);
  try {
    const out = await selectAreaPool(deps({ cfg: { ...DISCOVERY_DEFAULTS, general } }).d);
    assertEquals(ids(out.places), ["g:thin"]);
  } finally {
    g.restore();
  }
});

// ── MESITA-2338: the audit's Area fixes ─────────────────────────────────────

const OWNED_BASE: OwnedRow = {
  id: "mesita-1",
  google_place_id: "mine",
  lat: 25.6701,
  lng: CENTER.lng,
  enriched_at: "2026-01-01T00:00:00Z",
  content_state: "ready",
};

Deno.test("google: an owned hit is scored on Google's numbers when its stored ones are missing", async () => {
  reset();
  // The owned place is the nearest and the most loved on Google, but its
  // Mesita row has no stored stars or count. It must rank first, not sink to
  // the bottom on Popularity 0 and fall off the Feed's five.
  const g = stubGoogle([
    { id: "mine", lat: 25.6701, rating: 4.8, reviews: 3000 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, lat: 25.672 + i * 0.001, rating: 4.2, reviews: 200 })),
  ]);
  try {
    const { d } = deps({
      lookupOwned: () =>
        Promise.resolve([{ ...OWNED_BASE, google_stars_overall: null, google_review_count: null }]),
    });
    const out = await selectAreaPool(d);
    assertEquals(out.places[0].id, "mesita-1");
  } finally {
    g.restore();
  }
});

Deno.test("ownedCandidate: the hit's numbers first, the stored ones as fallback", () => {
  const hit = {
    placeId: "mine",
    name: "x",
    address: "",
    lat: 1,
    lng: 1,
    rating: 4.8,
    reviewCount: 3000,
    primaryType: "restaurant",
    businessStatus: "OPERATIONAL",
    openNow: null,
  };
  const stored = { ...OWNED_BASE, google_stars_overall: 3.1, google_review_count: 12 };
  const a = ownedCandidate(stored, hit);
  assertEquals([a.rating, a.reviewCount], [4.8, 3000]);
  const b = ownedCandidate(stored, { ...hit, rating: null, reviewCount: null });
  assertEquals([b.rating, b.reviewCount], [3.1, 12]);
});

Deno.test("google: an owned hit whose Mesita family is unknown keeps the family Google typed it into", async () => {
  reset();
  const g = stubGoogle([
    { id: "mine", lat: 25.6701, type: "restaurant" },
    { id: "other", lat: 25.672, type: "restaurant" },
  ]);
  try {
    const tacosRow = { ...OWNED_BASE, google_place_id: "other", id: "mesita-tacos", family_keys: ["tacos"] };
    const { d } = deps({
      families: ["dinner"],
      types: ["restaurant"],
      lookupOwned: () => Promise.resolve([{ ...OWNED_BASE, family_keys: ["undefined"] }, tacosRow]),
    });
    const out = await selectAreaPool(d);
    // Unknown on Mesita, `restaurant` on Google → Dinner: kept. A row Mesita
    // knows is Tacos stays Tacos and is cut under Dinner, as in Selected.
    assertEquals(ids(out.places), ["mesita-1"]);
  } finally {
    g.restore();
  }
});

Deno.test("nearbyExcludedTypesForFamilies: Dinner excludes the precise restaurants of other families", () => {
  const ex = nearbyExcludedTypesForFamilies(["restaurant"], ["dinner"]);
  for (const t of ["mexican_restaurant", "pizza_restaurant", "sushi_restaurant", "hamburger_restaurant"]) {
    assert(ex.includes(t), t);
  }
  assertEquals(ex.includes("restaurant"), false);
  assert(ex.length <= 50);
  // No family asked: only the restaurant-group types that sit in no family are cut.
  const all = nearbyExcludedTypesForFamilies(["restaurant"], []);
  assert(all.includes("meal_delivery"));
  for (const t of ["mexican_restaurant", "pizza_restaurant", "restaurant"]) assertEquals(all.includes(t), false, t);
  // Asking Dinner and Tacos keeps Mexican.
  assertEquals(
    nearbyExcludedTypesForFamilies(["restaurant", "mexican_restaurant"], ["dinner", "tacos"])
      .includes("mexican_restaurant"),
    false,
  );
});

Deno.test("nearbyExcludedTypesForFamilies: no pill still cuts the subtypes that sit in no family (MESITA-2382)", () => {
  const ex = nearbyExcludedTypesForFamilies(["tourist_attraction"], []);
  for (const t of ["event_venue", "marina", "plaza"]) assert(ex.includes(t), t);
  for (const t of ["zoo", "amusement_park", "tourist_attraction"]) assertEquals(ex.includes(t), false, t);
});

Deno.test("google: a family pill sends excludedPrimaryTypes; a precise type with no pill sends none", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    await selectAreaPool(deps({ families: ["dinner"], types: ["restaurant"] }).d);
    const body = JSON.parse(nearbyCalls(g.calls)[0].body ?? "{}");
    assertEquals(body.includedPrimaryTypes, ["restaurant"]);
    assert(Array.isArray(body.excludedPrimaryTypes));
    assert(body.excludedPrimaryTypes.includes("mexican_restaurant"));
    reset();
    await selectAreaPool(deps({ types: ["pizza_restaurant"] }).d);
    const plain = JSON.parse(nearbyCalls(g.calls)[1].body ?? "{}");
    assertEquals("excludedPrimaryTypes" in plain, false);
  } finally {
    g.restore();
  }
});

Deno.test("selected: the radius cut reads the exact distance, not the rounded one", () => {
  // 5.04 km shows as 5.0 km but is outside a 5 km radius.
  const row = {
    id: "edge",
    lat: CENTER.lat + 5.04 / 111.195,
    lng: CENTER.lng,
    enriched_at: "2026-01-01T00:00:00Z",
    content_state: "ready",
    google_stars_overall: 4.5,
    google_review_count: 100,
    family_keys: ["dinner"],
  };
  assertEquals(
    selectMesitaSelected([row], { center: CENTER, radiusKm: 5, params: DISCOVERY_DEFAULTS.params }).length,
    0,
  );
});

Deno.test("Area never embeds: no Area file calls an embedding or a vector signal", async () => {
  for (const file of [
    "./area-pipeline.ts",
    "./area-score.ts",
    "../consumer-web-list-places/index.ts",
    "../consumer-web-list-catalog/index.ts",
  ]) {
    const src = await Deno.readTextFile(new URL(file, import.meta.url));
    for (const banned of ["embedSingle", "embeddings-http", "descriptionSimilarity", "nameSimilarity"]) {
      assertEquals(src.includes(banned), false, `${file}: ${banned}`);
    }
  }
});

Deno.test("nearbyExcludedTypesForFamilies: only a general parent brings subtypes; a precise pill excludes nothing", () => {
  assertEquals(nearbyExcludedTypesForFamilies(["pizza_restaurant"], ["pizza"]), []);
  assertEquals(nearbyExcludedTypesForFamilies(["sushi_restaurant"], ["sushi"]), []);
  // Dinner's parent also reaches restaurant subtypes filed in other groups.
  assert(nearbyExcludedTypesForFamilies(["restaurant"], ["dinner"]).includes("dessert_restaurant"));
});

// ── MESITA-2379: one pool ───────────────────────────────────────────────────

const bodies = (calls: Call[]) => nearbyCalls(calls).map((c) => JSON.parse(c.body!));

Deno.test("googleCallsForStop: 20/40/60 → 1/2/3 calls", () => {
  assertEquals([20, 40, 60, 0, 999, Number.NaN].map(googleCallsForStop), [1, 2, 3, 1, 3, 1]);
});

Deno.test("fan-out: 40 and 60 make 2 and 3 DIFFERENT Nearby calls, never a second page", async () => {
  for (const calls of [2, 3]) {
    reset();
    const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
    try {
      const { d, quota } = deps({ googleCalls: calls, radiusKm: 8 });
      const out = await selectAreaPool(d);
      const sent = bodies(g.calls);
      assertEquals(sent.length, calls);
      assertEquals(new Set(sent.map((b) => JSON.stringify(b))).size, calls);
      assertEquals(sent[0].rankPreference, "DISTANCE");
      assertEquals(sent[1].rankPreference, "POPULARITY");
      if (calls === 3) assertEquals(sent[2].locationRestriction.circle.radius, 4000);
      assertEquals(quota(), calls);
      assertEquals(out.summary.googleBilled, calls);
      // The same place from every call is one candidate.
      assertEquals(ids(out.places), ["g:a"]);
    } finally {
      g.restore();
    }
  }
});

Deno.test("fan-out: one refused call adds nothing; the others still count (quota partial)", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    let n = 0;
    const { d } = deps({ googleCalls: 3, consumeQuota: () => Promise.resolve(++n !== 2) });
    const out = await selectAreaPool(d);
    assertEquals(nearbyCalls(g.calls).length, 2);
    assertEquals(out.summary.quota, "partial");
    assertEquals(out.summary.googleRefused, 1);
    assertEquals(ids(out.places), ["g:a"]);
  } finally {
    g.restore();
  }
});

Deno.test("fan-out: every call refused is quota refused and buys nothing", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    const { d } = deps({ googleCalls: 2, consumeQuota: () => Promise.resolve(false) });
    const out = await selectAreaPool(d);
    assertEquals(out.summary.quota, "refused");
    assertEquals(out.places, []);
  } finally {
    g.restore();
  }
});

Deno.test("the server snaps a point to ~110 m for retrieval; Proximity reads the raw centre", async () => {
  assertEquals(snapCenter({ lat: 25.67049, lng: -100.30012 }), { lat: 25.67, lng: -100.3 });
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.675 }]);
  try {
    const near = await selectAreaPool(deps({ center: { lat: 25.67001, lng: CENTER.lng }, radiusKm: 2 }).d);
    const far = await selectAreaPool(deps({ center: { lat: 25.66999, lng: CENTER.lng }, radiusKm: 2 }).d);
    // Same snapped cell: the second request is answered warm.
    assertEquals(nearbyCalls(g.calls).length, 1);
    assert(near.places[0].area.signals.proximity! > far.places[0].area.signals.proximity!);
  } finally {
    g.restore();
  }
});

Deno.test("area: every call ranks POPULARITY; bounds under 1 km still make 3 distinct calls", async () => {
  reset();
  const g = stubGoogle([{ id: "in", lat: 25.6705 }, { id: "out", lat: 25.69 }]);
  try {
    const bounds = { low: { lat: 25.668, lng: -100.302 }, high: { lat: 25.673, lng: -100.298 } };
    const { d } = deps({ location: { kind: "area", bounds }, googleCalls: 3 });
    const out = await selectAreaPool(d);
    const sent = bodies(g.calls);
    assertEquals(sent.length, 3);
    assertEquals(sent.every((b) => b.rankPreference === "POPULARITY"), true);
    assertEquals(new Set(sent.map((b) => JSON.stringify(b.locationRestriction))).size, 3);
    // Territory gate: the hit outside the rectangle never comes back.
    assertEquals(ids(out.places), ["g:in"]);
    assertEquals(out.places[0].area.formula, "area");
    assertEquals(out.places[0].area.gates.territory, 1);
    assertEquals(out.places[0].distance_km, null);
  } finally {
    g.restore();
  }
});

Deno.test("areaFanoutCircles: halves split across the longer side", () => {
  const wide = areaFanoutCircles(
    { kind: "area", bounds: { low: { lat: 0, lng: 0 }, high: { lat: 0.1, lng: 0.4 } } },
    3,
  );
  assert(wide[1].center.lng < wide[2].center.lng);
  assertEquals(wide[1].center.lat, wide[2].center.lat);
  assertEquals(areaFanoutCircles({ kind: "none" }, 3), []);
});

Deno.test("parseAreaBounds: valid, inverted, partial and oversized", () => {
  const ok = { low: { lat: 25.6, lng: -100.4 }, high: { lat: 25.7, lng: -100.3 } };
  assertEquals(parseAreaBounds(ok), ok);
  assertEquals(parseAreaBounds({ low: ok.high, high: ok.low }), null);
  assertEquals(parseAreaBounds({ low: ok.low }), null);
  assertEquals(parseAreaBounds({ low: { lat: 0, lng: 0 }, high: { lat: 2, lng: 2 } }), null);
  assertEquals(parseAreaBounds("x"), null);
  // Invalid bounds fall back to the point, then to none.
  assertEquals(resolveAreaLocation({ low: ok.high, high: ok.low }, CENTER, 5).kind, "point");
  assertEquals(resolveAreaLocation(null, null, 5).kind, "none");
  assertEquals(resolveAreaLocation(ok, CENTER, 5).kind, "area");
});

Deno.test("merge: an owned hit and the same Mesita row are ONE candidate, scored on the hit", async () => {
  reset();
  const g = stubGoogle([{ id: "mine", lat: 25.6701, rating: 4.9, reviews: 4000 }]);
  try {
    const row = { ...OWNED_BASE, google_stars_overall: 3.0, google_review_count: 5, family_keys: ["dinner"] };
    const { d } = deps({ mesitaRows: [row], lookupOwned: () => Promise.resolve([row]) });
    const out = await selectAreaPool(d);
    assertEquals(ids(out.places), ["mesita-1"]);
    assertEquals(out.places[0].area.source, "selected");
    assertEquals(out.places[0].area.gates.reviews, 1);
    assertEquals(out.places[0].area.gates.ready, 1);
    // The card keeps its own facts…
    assertEquals(out.places[0].google_stars_overall, 3.0);
  } finally {
    g.restore();
  }
});

Deno.test("merge: a ready owned row missing a fact borrows the hit's", async () => {
  reset();
  const g = stubGoogle([{ id: "mine", lat: 25.6701, rating: 4.6, reviews: 800 }]);
  try {
    const row = { ...OWNED_BASE, google_stars_overall: null, google_review_count: null };
    const out = await selectAreaPool(deps({ lookupOwned: () => Promise.resolve([row]) }).d);
    assertEquals(out.places[0].google_stars_overall, 4.6);
    assertEquals(out.places[0].google_review_count, 800);
    assertEquals("google_place_id" in out.places[0], false);
  } finally {
    g.restore();
  }
});

Deno.test("merge: a Google hit owned by a row OUTSIDE the Mesita candidates still renders as that row", async () => {
  reset();
  const g = stubGoogle([{ id: "mine", lat: 25.6701 }]);
  try {
    // The Mesita read never returned the owner (past the cap, or another family).
    const out = await selectAreaPool(deps({ mesitaRows: [], lookupOwned: () => Promise.resolve([OWNED_BASE]) }).d);
    assertEquals(ids(out.places), ["mesita-1"]);
    assertEquals(out.places.some((p) => String(p.id).startsWith("g:")), false);
  } finally {
    g.restore();
  }
});

Deno.test("merge: Google and Mesita candidates rank in ONE order, Selected × 1.0 and the rest × 0.3", async () => {
  reset();
  const g = stubGoogle([
    { id: "loved", lat: 25.6701, rating: 4.9, reviews: 9000 },
    { id: "meh", lat: 25.6702, rating: 3.0, reviews: 20 },
  ]);
  try {
    const selected = mrow("sel", { lat: 25.6702, google_stars_overall: 4.0, google_review_count: 200 });
    const created = mrow("created", { enriched_at: null, lat: 25.6702, google_stars_overall: 4.9, google_review_count: 9000 });
    const out = await selectAreaPool(deps({ mesitaRows: [selected, created] }).d);
    assertEquals(ids(out.places)[0], "sel");
    const byId = Object.fromEntries(out.places.map((p) => [p.id, p.area]));
    assertEquals(byId["sel"].selected, 1);
    assertEquals(byId["created"].source, "mesita");
    assertEquals(byId["created"].selected, 0.3);
    assertEquals(byId["g:loved"].source, "google");
    for (const a of Object.values(byId)) {
      assertEquals(Math.abs(a.final - a.base * a.selected) < 1e-12, true);
    }
    // The order is the final score's, whatever the source.
    const finals = out.places.map((p) => p.area.final);
    assertEquals(finals, [...finals].sort((a, b) => b - a));
    assertEquals(out.summary.mesita, 2);
    assertEquals(out.summary.google, 2);
  } finally {
    g.restore();
  }
});

Deno.test("mesitaLimit keeps the top Mesita candidates by score, not the first rows read", async () => {
  const rows = [
    mrow("weak", { google_stars_overall: 2.0, google_review_count: 3 }),
    mrow("strong", { google_stars_overall: 4.9, google_review_count: 3000 }),
  ];
  const out = await selectAreaPool(deps({ apiKey: null, mesitaRows: rows, mesitaLimit: 1 }).d);
  assertEquals(ids(out.places), ["strong"]);
});

Deno.test("no location: Mesita only, Popularity × selected, no Google call", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    const out = await selectAreaPool(deps({ center: null, mesitaRows: [mrow("far", { lat: 40 })] }).d);
    assertEquals(nearbyCalls(g.calls).length, 0);
    assertEquals(ids(out.places), ["far"]);
    assertEquals(out.places[0].area.formula, "none");
    assertEquals(out.places[0].area.signals.proximity, null);
  } finally {
    g.restore();
  }
});

Deno.test("selectedPoolQuery: the Feed and the Map drop the Selected SQL filter; an area reads its bounds", () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  selectedPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
    bounds: { low: { lat: 25.6, lng: -100.4 }, high: { lat: 25.7, lng: -100.3 } },
    selectedOnly: false,
  });
  assertEquals(seen.includes("not enriched_at is null"), false);
  assert(seen.includes("eq content_state ready"));
  assert(seen.includes("gte lat 25.6"));
  assert(seen.includes("lte lng -100.3"));
  assertEquals(seen[seen.length - 1], "order id true");
});
