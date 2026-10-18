import { assert, assertEquals } from "jsr:@std/assert@1";
import { __resetNearbyGoogleCacheForTests } from "./nearby-places.ts";
import {
  FEED_GOOGLE_TYPES,
  type GoogleSelectionDeps,
  type OwnedRow,
  selectedPoolQuery,
  selectGooglePlaces,
  selectMesitaSelected,
} from "./area-pipeline.ts";
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
    primaryType: "restaurant",
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

function deps(over: Partial<GoogleSelectionDeps<OwnedRow>> = {}) {
  let quotaCalls = 0;
  const lookups: string[][] = [];
  const d: GoogleSelectionDeps<OwnedRow> = {
    apiKey: "k",
    center: CENTER,
    radiusKm: 50,
    types: FEED_GOOGLE_TYPES,
    minReviews: 0,
    limit: 5,
    cfg: DISCOVERY_DEFAULTS,
    consumeQuota: () => {
      quotaCalls++;
      return Promise.resolve(true);
    },
    lookupOwned: (gids: string[]) => {
      lookups.push(gids);
      return Promise.resolve([] as OwnedRow[]);
    },
    ...over,
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
    await selectGooglePlaces(d);
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

Deno.test("google: the guest review floor cuts after Google answers, never a refill", async () => {
  reset();
  const g = stubGoogle([
    { id: "thin", lat: 25.6701, reviews: 12 },
    { id: "loved", lat: 25.672, reviews: 900 },
  ]);
  try {
    const { d } = deps({ minReviews: 100 });
    const out = await selectGooglePlaces(d);
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
    const out = await selectGooglePlaces(deps().d);
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
    const out = await selectGooglePlaces(d);
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
    const out = await selectGooglePlaces(deps().d);
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
    const out = await selectGooglePlaces(deps().d);
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
    const out = await selectGooglePlaces(deps().d);
    assertEquals(ids(out.places), ["g:closed-near", "g:open-far"]);
  } finally {
    g.restore();
  }
});

Deno.test("google: the Family gate drops a hit outside the requested families", async () => {
  reset();
  const g = stubGoogle([{ id: "a-restaurant", lat: 25.6701 }]);
  try {
    const out = await selectGooglePlaces(deps({ families: ["coffee"] }).d);
    assertEquals(out.places, []);
    const all = await selectGooglePlaces(deps({ families: [] }).d);
    assertEquals(ids(all.places), ["g:a-restaurant"]);
  } finally {
    g.restore();
  }
});

Deno.test("google: at most `limit`", async () => {
  reset();
  const g = stubGoogle(
    Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, lat: 25.6701 + i / 1e4 })),
  );
  try {
    const out = await selectGooglePlaces(deps({ limit: 5 }).d);
    assertEquals(out.places.length, 5);
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
      const out = await selectGooglePlaces(d);
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
    const out = await selectGooglePlaces(d);
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
    assertEquals((await selectGooglePlaces(deps().d)).places, []);
  } finally {
    g.restore();
  }
  const ok = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    assertEquals(ids((await selectGooglePlaces(deps().d)).places), ["g:a"]);
    assertEquals(nearbyCalls(ok.calls).length, 1);
  } finally {
    ok.restore();
  }
});

Deno.test("google: an owned-row lookup error fails closed (no stub may shadow a Mesita place)", async () => {
  reset();
  const g = stubGoogle([{ id: "a", lat: 25.6701 }]);
  try {
    const out = await selectGooglePlaces(
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
    await selectGooglePlaces(deps().d);
    const second = deps();
    const out = await selectGooglePlaces(second.d);
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

Deno.test("selected: proximity × popularity ranks; the nearer twin first", () => {
  const out = selectMesitaSelected([
    mrow("far-twin", { lat: CENTER.lat + 0.02 }),
    mrow("near-twin", { lat: CENTER.lat + 0.001 }),
  ], selOpts);
  assertEquals(ids(out), ["near-twin", "far-twin"]);
  // quiet: 1 × ln(16.5)/ln(4501) ≈ 0.33; loved at 1.1 km: 0.83 × 1.
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

Deno.test("selected: the half distance is the operator's (params.proximity.halfDistanceKm)", () => {
  const rows = [
    mrow("near-quiet", { lat: CENTER.lat + 0.001, google_stars_overall: 4.0, google_review_count: 100 }),
    mrow("far-loved", { lat: CENTER.lat + 0.05, google_stars_overall: 4.9, google_review_count: 4000 }),
  ];
  const tight = {
    ...selOpts,
    params: { ...selOpts.params, proximity: { ...selOpts.params.proximity, halfDistanceKm: 0.5 } },
  };
  const loose = {
    ...selOpts,
    params: { ...selOpts.params, proximity: { ...selOpts.params.proximity, halfDistanceKm: 40 } },
  };
  assertEquals(ids(selectMesitaSelected(rows, tight))[0], "near-quiet");
  assertEquals(ids(selectMesitaSelected(rows, loose))[0], "far-loved");
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
});

Deno.test("google: the operator's floor cuts Google hits; the higher floor wins (MESITA-2319)", async () => {
  reset();
  const g = stubGoogle([
    { id: "thin", lat: 25.6701, reviews: 150 },
    { id: "loved", lat: 25.672, reviews: 900 },
  ]);
  try {
    const cfg = { ...DISCOVERY_DEFAULTS, map: { ...DISCOVERY_DEFAULTS.map, googleMinReviews: 500 } };
    const out = await selectGooglePlaces(deps({ cfg, minReviews: 100 }).d);
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
  };
  const general = { ...DISCOVERY_DEFAULTS.general, minReviews: 500 };
  selectedPoolQuery(q, { general }, { center: null, radiusKm: 5 });
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
  reset();
  const g = stubGoogle([{ id: "thin", lat: 25.6701, reviews: 12 }]);
  try {
    const out = await selectGooglePlaces(deps({ cfg: { ...DISCOVERY_DEFAULTS, general } }).d);
    assertEquals(ids(out.places), ["g:thin"]);
  } finally {
    g.restore();
  }
});
