import { assertEquals } from "jsr:@std/assert@1";
import { NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import {
  __resetNearbyGoogleCacheForTests,
  __setLegacyPageTokenDelayForTests,
  CATALOG_NEARBY_HARD_MAX,
  claimOwnedHits,
  GOOGLE_FANOUT_MAX,
  GOOGLE_NEARBY_MAX,
  nearbyCallCount,
  parsePlacesScope,
  admitsScopeRow,
  isEnrichedListedRow,
  isMesitaListedRow,
  lanesForPlacesScope,
  mergeNearbyCatalog,
  peekCachedNearbyPlaces,
  resolveGoogleItem,
  searchNearbyPlaces,
  type NearbyHit,
  type NearbyLaneCaps,
} from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };
const SCOPE_MESITA: NearbyLaneCaps = {
  mesitaCount: 20,
  googleCount: 0,
};
const SCOPE_GOOGLE: NearbyLaneCaps = {
  mesitaCount: 0,
  googleCount: 20,
};

function nearbyHit(
  placeId: string,
  lat: number,
  lng: number,
  primaryType = "cafe",
): NearbyHit {
  return {
    placeId,
    name: placeId,
    address: "",
    lat,
    lng,
    rating: null,
    primaryType,
    businessStatus: "OPERATIONAL",
    reviewCount: null,
  };
}

Deno.test("mergeNearbyCatalog: Google set paints a Mesita hit, does not add extras", () => {
  const mesita = [
    { id: "m1", google_place_id: "ChIJ1", lat: 25.6701, lng: -100.3001 },
    { id: "m2", google_place_id: "ChIJ2", lat: 25.68, lng: -100.31 },
  ];
  const google = [
    nearbyHit("ChIJ1", 25.6701, -100.3001, "restaurant"),
    nearbyHit("ChIJ9", 25.6702, -100.3002, "bar"),
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, SCOPE_GOOGLE);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["m1", "ChIJ9"],
  );
});

Deno.test("mergeNearbyCatalog: Google set is N pins, not Mesita plus Google", () => {
  const mesita = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `gid-${i}`,
    lat: 25.67 + i * 0.01,
    lng: -100.3,
  }));
  const google = Array.from({ length: 5 }, (_, i) =>
    nearbyHit(`gOnly-${i}`, 25.67005 + i * 0.0001, -100.3)
  );
  const got = mergeNearbyCatalog(mesita, google, CENTER, {
    mesitaCount: 0,
    googleCount: 5,
  });
  assertEquals(got.length, 5);
  assertEquals(got.every((x) => x.kind === "google"), true);
});

Deno.test("mergeNearbyCatalog: an older close Mesita row still paints over Google", () => {
  const mesita = [
    { id: "old-close", google_place_id: "ChIJ-old", lat: 25.67005, lng: -100.30005 },
  ];
  const google = [
    nearbyHit("ChIJ-old", 25.67005, -100.30005, "restaurant"),
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, SCOPE_GOOGLE);
  assertEquals(got.length, 1);
  assertEquals(got[0].kind, "listed");
  if (got[0].kind === "listed") assertEquals(got[0].row.id, "old-close");
});

Deno.test("mergeNearbyCatalog: drops bbox-corner rows past the 50 km circle", () => {
  const mesita = [
    { id: "inside", google_place_id: "in", lat: 25.6701, lng: -100.3001 },
    { id: "corner", google_place_id: "far", lat: 26.22, lng: -100.3 },
  ];
  const google = [
    nearbyHit("g-close", 25.6702, -100.3002),
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, SCOPE_GOOGLE);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["g-close"],
  );
});

Deno.test("mergeNearbyCatalog: closest-N only — the ring cut happens upstream", () => {
  // The Places ring is applied by admitsScopeRow BEFORE the merge, so
  // this function stays a pure closest-N: the closest rows handed to it win.
  const mesita = [
    { id: "np-close", google_place_id: "np", lat: 25.67005, lng: -100.30005 },
    { id: "p-far", google_place_id: "p", lat: 25.8, lng: -100.3 },
  ];
  const got = mergeNearbyCatalog(mesita, [], CENTER, SCOPE_MESITA);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["np-close", "p-far"],
  );
});

Deno.test("mergeNearbyCatalog: Google 20 is 14 stubs + 4 Mesita + 2 partners", () => {
  const partners = Array.from({ length: 2 }, (_, i) => ({
    id: `p${i}`,
    plan: "pro",
    google_place_id: `p${i}`,
    lat: 25.67001 + i * 0.00001,
    lng: -100.3,
  }));
  const extraMesita = Array.from({ length: 4 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.67005 + i * 0.00001,
    lng: -100.3,
  }));
  const farMesita = Array.from({ length: 10 }, (_, i) => ({
    id: `far${i}`,
    plan: "free",
    google_place_id: `far${i}`,
    lat: 25.85 + i * 0.001,
    lng: -100.3,
  }));
  const stubs = Array.from({ length: 14 }, (_, i) =>
    nearbyHit(`g${i}`, 25.6702 + i * 0.00001, -100.3)
  );
  const google = [
    ...partners.map((row) => nearbyHit(row.google_place_id, row.lat, row.lng, "restaurant")),
    ...extraMesita.map((row) => nearbyHit(row.google_place_id, row.lat, row.lng, "restaurant")),
    ...stubs,
  ];
  const got = mergeNearbyCatalog(
    [...partners, ...extraMesita, ...farMesita],
    google,
    CENTER,
    SCOPE_GOOGLE,
  );
  assertEquals(got.length, 20);
  assertEquals(got.filter((x) => x.kind === "listed").length, 6);
  assertEquals(got.filter((x) => x.kind === "google").length, 14);
  assertEquals(
    got.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    [...partners, ...extraMesita].map((row) => row.id),
  );
  assertEquals(
    got.some((x) => x.kind === "listed" && x.row.id.startsWith("far")),
    false,
  );
});

Deno.test("mergeNearbyCatalog: Google set does not add a far Mesita miss", () => {
  const partners = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    plan: "pro",
    google_place_id: `p${i}`,
    lat: 25.85 + i * 0.0001,
    lng: -100.3,
  }));
  const extraMesita = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.75 + i * 0.0001,
    lng: -100.3,
  }));
  const extraGoogle = Array.from({ length: 10 }, (_, i) =>
    nearbyHit(`g${i}`, 25.69 + i * 0.0001, -100.3)
  );
  const google = [
    ...partners.map((row) => nearbyHit(row.google_place_id, row.lat, row.lng, "restaurant")),
    ...extraGoogle,
  ];
  const got = mergeNearbyCatalog([...partners, ...extraMesita], google, CENTER, {
    mesitaCount: 10,
    googleCount: 20,
  });
  assertEquals(got.length, 20);
  assertEquals(got.filter((x) => x.kind === "listed").length, 10);
  assertEquals(got.filter((x) => x.kind === "google").length, 10);
});

Deno.test("mergeNearbyCatalog: empty Nearby falls back to the Mesita set", () => {
  const mesita = Array.from({ length: 15 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `shared-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const got = mergeNearbyCatalog(mesita, [], CENTER, {
    mesitaCount: 10,
    googleCount: 20,
  });
  assertEquals(got.length, 10);
  assertEquals(got.every((x) => x.kind === "listed"), true);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : ""),
    mesita.slice(0, 10).map((row) => row.id),
  );
});

Deno.test("mergeNearbyCatalog: Google nearest-N paints overlaps and keeps length N", () => {
  const mesita = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `win-${i}`,
    lat: 25.67001 + i * 0.00001,
    lng: -100.3,
  }));
  const overlap = mesita.map((row) =>
    nearbyHit(row.google_place_id, row.lat, row.lng)
  );
  const unique = Array.from({ length: 15 }, (_, i) =>
    nearbyHit(`g-only-${i}`, 25.68 + i * 0.0001, -100.3)
  );
  const got = mergeNearbyCatalog(mesita, [...overlap, ...unique], CENTER, SCOPE_GOOGLE);
  assertEquals(got.length, 20);
  assertEquals(got.filter((x) => x.kind === "listed").length, 10);
  assertEquals(got.filter((x) => x.kind === "google").length, 10);
  assertEquals(
    got.filter((x) => x.kind === "google").map((x) =>
      x.kind === "google" ? x.hit.placeId : ""
    ),
    unique.slice(0, 10).map((hit) => hit.placeId),
  );
});

Deno.test("mergeNearbyCatalog: agreeing Google and Mesita IDs stay length N", () => {
  const mesita = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `shared-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) =>
    nearbyHit(`shared-${i}`, 25.67 + i * 0.001, -100.3, "bar")
  );
  const got = mergeNearbyCatalog(mesita, google, CENTER, SCOPE_GOOGLE);
  assertEquals(got.length, GOOGLE_NEARBY_MAX);
  assertEquals(got.every((x) => x.kind === "listed"), true);
});

Deno.test("mergeNearbyCatalog: Google set ignores a far Mesita pool", () => {
  const mesita = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `far-${i}`,
    lat: 25.85 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) =>
    nearbyHit(`near-${i}`, 25.67005 + i * 0.0001, -100.3)
  );
  const got = mergeNearbyCatalog(mesita, google, CENTER, SCOPE_GOOGLE);
  assertEquals(got.length, SCOPE_GOOGLE.googleCount);
  assertEquals(got.every((x) => x.kind === "google"), true);
});

const OK_BODY = JSON.stringify({
  places: [{
    id: "places/ChIJ-ok",
    displayName: { text: "Ok Cafe" },
    formattedAddress: "1 Main",
    location: { latitude: 25.67, longitude: -100.3 },
    rating: 4.1,
    primaryType: "cafe",
  }],
});

Deno.test("searchNearbyPlaces: one Nearby Search carries every enabled primary type", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  let body: {
    includedPrimaryTypes?: string[];
    maxResultCount?: number;
    rankPreference?: string;
  } = {};
  const orig = globalThis.fetch;
  globalThis.fetch = (_url, init) => {
    n++;
    body = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    await searchNearbyPlaces("k", CENTER);
    assertEquals(n, 1);
    assertEquals(body.includedPrimaryTypes, [...NEARBY_TYPE_KEYS]);
    assertEquals(body.maxResultCount, GOOGLE_NEARBY_MAX);
    assertEquals(body.rankPreference, "DISTANCE");
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: success is cached for the cell", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const a = await searchNearbyPlaces("k", CENTER);
    const b = await searchNearbyPlaces("k", CENTER);
    assertEquals(a.length, 1);
    assertEquals(a[0].placeId, "ChIJ-ok");
    assertEquals(b.length, 1);
    assertEquals(n, 1);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: a failed call is not cached so a retry can succeed", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    if (n === 1) {
      return Promise.resolve(new Response("fail", { status: 429 }));
    }
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const a = await searchNearbyPlaces("k", CENTER);
    const b = await searchNearbyPlaces("k", CENTER);
    assertEquals(a.length, 0);
    assertEquals(b.length, 1);
    assertEquals(n, 2);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("peekCachedNearbyPlaces: warm cell is visible, cold is not", async () => {
  __resetNearbyGoogleCacheForTests();
  const orig = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  try {
    assertEquals(peekCachedNearbyPlaces(CENTER), null);
    await searchNearbyPlaces("k", CENTER);
    const cached = peekCachedNearbyPlaces(CENTER);
    assertEquals(cached?.length, 1);
    assertEquals(cached?.[0].placeId, "ChIJ-ok");
    assertEquals(peekCachedNearbyPlaces({ lat: 10, lng: -100 }), null);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: isolate fan-out budget skips extra cells", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    for (let i = 0; i <= GOOGLE_FANOUT_MAX; i++) {
      await searchNearbyPlaces("k", { lat: 10 + i, lng: -100.3 });
    }
    assertEquals(n, GOOGLE_FANOUT_MAX);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: beforeFanout runs only on the starting fan-out", async () => {
  __resetNearbyGoogleCacheForTests();
  let fetches = 0;
  let gates = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    fetches++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  const beforeFanout = () => {
    gates++;
    return Promise.resolve(true);
  };
  try {
    const [a, b] = await Promise.all([
      searchNearbyPlaces("k", CENTER, { beforeFanout }),
      searchNearbyPlaces("k", CENTER, { beforeFanout }),
    ]);
    assertEquals(a.length, 1);
    assertEquals(b.length, 1);
    assertEquals(gates, 1);
    assertEquals(fetches, 1);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: a type subset is one request and caches separately", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const a = await searchNearbyPlaces("k", CENTER, { types: ["cafe"] });
    const b = await searchNearbyPlaces("k", CENTER, { types: ["cafe"] });
    assertEquals(a.length, 1);
    assertEquals(b.length, 1);
    assertEquals(n, 1);
    assertEquals(peekCachedNearbyPlaces(CENTER, ["cafe"])?.length, 1);
    assertEquals(peekCachedNearbyPlaces(CENTER), null);
    await searchNearbyPlaces("k", CENTER);
    assertEquals(n, 2);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: empty types skip Google", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const got = await searchNearbyPlaces("k", CENTER, { types: [] });
    assertEquals(got, []);
    assertEquals(n, 0);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: beforeFanout false skips Google", async () => {
  __resetNearbyGoogleCacheForTests();
  let fetches = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    fetches++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const got = await searchNearbyPlaces("k", CENTER, {
      beforeFanout: () => Promise.resolve(false),
    });
    assertEquals(got, []);
    assertEquals(fetches, 0);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: isolate budget skip does not call beforeFanout", async () => {
  __resetNearbyGoogleCacheForTests();
  let fetches = 0;
  let gates = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    fetches++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    for (let i = 0; i < GOOGLE_FANOUT_MAX; i++) {
      await searchNearbyPlaces("k", { lat: 10 + i, lng: -100.3 });
    }
    const got = await searchNearbyPlaces("k", { lat: 40, lng: -100.3 }, {
      beforeFanout: () => {
        gates++;
        return Promise.resolve(true);
      },
    });
    assertEquals(got, []);
    assertEquals(gates, 0);
    assertEquals(fetches, GOOGLE_FANOUT_MAX);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("places scope: three nested sets, named on the wire, Mesita by default", () => {
  // The absent value is the one that matters most: any caller that posts no
  // scope lands on it, so it must be the Mesita set, never a paid call.
  assertEquals(parsePlacesScope(undefined), "mesita");
  assertEquals(parsePlacesScope(null), "mesita");
  assertEquals(parsePlacesScope(""), "mesita");
  assertEquals(parsePlacesScope("nope"), "mesita");
  assertEquals(parsePlacesScope({}), "mesita");
  // A scope this EF does not name reads as the default, an old client's
  // `partners` included.
  assertEquals(parsePlacesScope("partners"), "mesita");
  assertEquals(parsePlacesScope("MESITA"), "mesita");
  assertEquals(parsePlacesScope(" google "), "google");
  assertEquals(parsePlacesScope(" Enriched "), "enriched");
  // Legacy ordinals keep their OLD shipped meanings, so a client deployed
  // before this EF still gets the set it asked for during the skew window.
  assertEquals(parsePlacesScope(1), "mesita");
  assertEquals(parsePlacesScope(2), "google");
  assertEquals(parsePlacesScope(3), "google");
  assertEquals(parsePlacesScope("2"), "google");

  // Lane caps are the GUEST's How many, never a console knob. Only the
  // Google ring opens the Google lane — the Mesita ring never does.
  assertEquals(lanesForPlacesScope("enriched", 20), { mesitaCount: 20, googleCount: 0 });
  assertEquals(lanesForPlacesScope("mesita", 20), { mesitaCount: 20, googleCount: 0 });
  assertEquals(lanesForPlacesScope("google", 20), { mesitaCount: 20, googleCount: 20 });
  // Google's own Nearby call tops out at 20 however large How many is.
  assertEquals(lanesForPlacesScope("google", 60), { mesitaCount: 60, googleCount: 20 });
  // Garbage and overshoot clamp to the largest How many stop.
  assertEquals(lanesForPlacesScope("google", 999).mesitaCount, CATALOG_NEARBY_HARD_MAX);
  assertEquals(lanesForPlacesScope("mesita", Number.NaN).mesitaCount, 0);

  // MESITA-2154: the ring admits enriched_at set, and nothing else. A
  // Created place (ready, no stamp) is outside it.
  assertEquals(isEnrichedListedRow({ enriched_at: "2026-08-01T00:00:00Z" }), true);
  const created = { content_state: "ready", enriched_at: null };
  assertEquals(isEnrichedListedRow(created), false);
  assertEquals(isEnrichedListedRow({ enriched_at: null }), false);
  assertEquals(isEnrichedListedRow({}), false);
});

// ── Three rings admit nested Mesita rows (MESITA-2158) ─────────────────────

const ENRICHED_ROW = { content_state: "ready", enriched_at: "2026-08-01T00:00:00Z" };
const CREATED_ROW = { content_state: "ready", enriched_at: null };
const MID_REENRICH_ROW = {
  content_state: "generating",
  enriched_at: "2026-08-01T00:00:00Z",
};
const SCOPES = ["enriched", "mesita", "google"] as const;

Deno.test("admitsScopeRow: a Created place is in Mesita Places, never in Mesita Enriched Places", () => {
  assertEquals(isMesitaListedRow(CREATED_ROW), true);
  assertEquals(admitsScopeRow("enriched", CREATED_ROW), false);
  assertEquals(admitsScopeRow("mesita", CREATED_ROW), true);
  assertEquals(admitsScopeRow("google", CREATED_ROW), true);
});

Deno.test("admitsScopeRow: an enriched place is in all three rings", () => {
  for (const scope of SCOPES) {
    assertEquals(admitsScopeRow(scope, ENRICHED_ROW), true, scope);
  }
});

Deno.test("admitsScopeRow: a profile that cannot be shown now is in no Mesita ring", () => {
  // Enriched but mid re-enrich: the Enriched gate's ready half, on every ring.
  for (const scope of SCOPES) {
    assertEquals(admitsScopeRow(scope, MID_REENRICH_ROW), false, scope);
    assertEquals(admitsScopeRow(scope, { enriched_at: null }), false, scope);
  }
});

Deno.test("admitsScopeRow: the rings nest — enriched ⊆ mesita ⊆ google", () => {
  const rows = [
    ENRICHED_ROW,
    CREATED_ROW,
    MID_REENRICH_ROW,
    { content_state: "failed", enriched_at: null },
    {},
  ];
  const count = (scope: (typeof SCOPES)[number]) =>
    rows.filter((row) => admitsScopeRow(scope, row)).length;
  for (const row of rows) {
    if (admitsScopeRow("enriched", row)) {
      assertEquals(admitsScopeRow("mesita", row), true);
    }
    // Google keeps exactly the Mesita ring's rows; it only adds Google hits.
    assertEquals(admitsScopeRow("google", row), admitsScopeRow("mesita", row));
  }
  assertEquals([count("enriched"), count("mesita"), count("google")], [1, 2, 2]);
});

Deno.test("claimOwnedHits: on the Google ring a Created row is a ring row, never a stub", () => {
  const hits = [nearbyHit("gid-created", 25.6701, -100.3001)];
  const created = {
    id: "c",
    google_place_id: "gid-created",
    lat: 25.6701,
    lng: -100.3001,
    ...CREATED_ROW,
  };
  const ring = [created].filter((row) => admitsScopeRow("google", row));
  const claim = claimOwnedHits(hits, [created], ring);
  assertEquals(claim.hits.map((hit) => hit.placeId), ["gid-created"]);
  assertEquals(claim.paintByGid.size, 0);
  // Merge pairs it with the row; were it unpaired it drops, never a stub.
  assertEquals(resolveGoogleItem(hits[0]!, claim).kind, "drop");
  const merged = mergeNearbyCatalog(ring, hits, CENTER, lanesForPlacesScope("google", 20));
  assertEquals(merged.map((item) => item.kind), ["listed"]);
});

// ── Owned hits never go out as stubs (MESITA-2154) ──────────────────────────
//
// A stub's "Add to Mesita" posts consumer-web-create-place, which 409s
// `place_already_exists` for a google_place_id Mesita owns. The owned rows
// come from an UNFILTERED gid lookup, so a Created row that failed the
// guest's Super overlap (door synthesis left `['undefined']`) or Popularity
// floor is still here — and must paint its hit, never fall through.

type OwnedRow = {
  id: string;
  google_place_id: string | null;
  enriched_at: string | null;
  content_state: string;
  family_keys: string[];
  google_review_count: number | null;
};

const ownedRow = (over: Partial<OwnedRow> & { id: string }): OwnedRow => ({
  google_place_id: `gid-${over.id}`,
  enriched_at: null,
  content_state: "ready",
  family_keys: ["undefined"],
  google_review_count: 3,
  ...over,
});

Deno.test("claimOwnedHits: a Created row that failed the family and reviews cuts paints its hit, never a stub", () => {
  const created = ownedRow({ id: "c1" });
  const hits = [nearbyHit("gid-c1", 25.671, -100.301), nearbyHit("gid-g1", 25.672, -100.302)];
  // The ring is empty: the Created row failed every Mesita-side cut.
  const claim = claimOwnedHits(hits, [created], []);
  assertEquals(claim.hits.map((h) => h.placeId), ["gid-c1", "gid-g1"]);
  const out = resolveGoogleItem(hits[0], claim);
  assertEquals(out.kind, "mesita");
  assertEquals(out.kind === "mesita" ? out.row.id : null, "c1");
  // A hit nobody owns is still a Google stub.
  assertEquals(resolveGoogleItem(hits[1], claim).kind, "stub");
});

Deno.test("claimOwnedHits: an Enriched row the ring cuts left out drops its hit", () => {
  const enriched = ownedRow({ id: "e1", enriched_at: "2026-10-01T00:00:00Z" });
  const hits = [nearbyHit("gid-e1", 25.671, -100.301)];
  const claim = claimOwnedHits(hits, [enriched], []);
  assertEquals(claim.hits, []);
  // Even if a hit slipped through, the last word is drop, not stub.
  assertEquals(resolveGoogleItem(hits[0], claim).kind, "drop");
});

Deno.test("claimOwnedHits: a ring row's hit passes for merge to pair; unpaired, it drops", () => {
  const ring = ownedRow({ id: "r1", enriched_at: "2026-10-01T00:00:00Z" });
  const hits = [nearbyHit("gid-r1", 25.671, -100.301)];
  const claim = claimOwnedHits(hits, [ring], [ring]);
  assertEquals(claim.hits.map((h) => h.placeId), ["gid-r1"]);
  assertEquals(claim.paintByGid.size, 0);
  // A later JS cut removed the ring row, so merge left the hit unpaired.
  assertEquals(resolveGoogleItem(hits[0], claim).kind, "drop");
});

Deno.test("claimOwnedHits: every owned gid resolves to Mesita or drop, never a `g:` stub", () => {
  const rows = [
    ownedRow({ id: "c1" }),
    ownedRow({ id: "c2", content_state: "generating" }),
    ownedRow({ id: "c3", content_state: "failed", family_keys: ["bars"] }),
    ownedRow({ id: "e1", enriched_at: "2026-10-01T00:00:00Z" }),
    ownedRow({ id: "e2", enriched_at: "2026-10-01T00:00:00Z", content_state: "failed" }),
  ];
  const hits = rows.map((row, i) => nearbyHit(row.google_place_id!, 25.67 + i / 1000, -100.3));
  const claim = claimOwnedHits(hits, rows, []);
  for (const hit of hits) {
    assertEquals(resolveGoogleItem(hit, claim).kind === "stub", false, hit.placeId);
  }
  assertEquals([...claim.paintByGid.keys()].sort(), ["gid-c1", "gid-c2", "gid-c3"]);
  assertEquals(claim.hits.map((h) => h.placeId).sort(), ["gid-c1", "gid-c2", "gid-c3"]);
});

Deno.test("claimOwnedHits: rows without a google_place_id claim nothing", () => {
  const hits = [nearbyHit("gid-x", 25.671, -100.301)];
  const claim = claimOwnedHits(hits, [ownedRow({ id: "n1", google_place_id: "  " })], []);
  assertEquals(claim.ownedGids.size, 0);
  assertEquals(resolveGoogleItem(hits[0], claim).kind, "stub");
});


// MESITA-1695 / MESITA-1796: the operator picks 20 / 40 / 60 as max Google
// input. Google bills Nearby in pages of 20; 40 and 60 are 2 and 3 billed
// calls over the same query (Legacy next_page_token), not type-slice fan-out.
Deno.test("nearbyCallCount: a stop is a page count, and never exceeds 3", () => {
  assertEquals(nearbyCallCount(undefined), 1);
  assertEquals(nearbyCallCount(20), 1);
  assertEquals(nearbyCallCount(40), 2);
  assertEquals(nearbyCallCount(60), 3);
  // Junk cannot buy a fourth call.
  assertEquals(nearbyCallCount(1_000), 3);
  assertEquals(nearbyCallCount(0), 1);
  assertEquals(nearbyCallCount(-5), 1);
});

Deno.test("searchNearbyPlaces: pull 60 paginates Legacy and dedupes the union", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    n++;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("nearbysearch/json")) {
      const page = url.includes("pagetoken=page2") ? 2 : url.includes("pagetoken=page1") ? 1 : 0;
      const placeId = page === 0 ? "ChIJ-ok" : page === 1 ? "ChIJ-p1" : "ChIJ-p2";
      return Promise.resolve(
        new Response(JSON.stringify({
          status: "OK",
          results: [{
            place_id: placeId,
            name: `Place ${page}`,
            vicinity: "1 Main",
            geometry: { location: { lat: 25.67 + page * 0.001, lng: -100.3 } },
            types: ["restaurant"],
          }],
          next_page_token: page < 2 ? `page${page + 1}` : undefined,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("unexpected", { status: 500 }));
  };
  try {
    __setLegacyPageTokenDelayForTests(0);
    const hits = await searchNearbyPlaces("k", CENTER, {
      types: ["restaurant", "cafe", "bakery"],
      pull: 60,
    });
    assertEquals(n, 3);
    assertEquals(hits.length, 3);
    assertEquals(hits.map((h) => h.placeId), ["ChIJ-ok", "ChIJ-p1", "ChIJ-p2"]);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: the pull is part of the cache cell", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    await searchNearbyPlaces("k", CENTER, { types: ["restaurant"], pull: 20 });
    assertEquals(n, 1);
    // Same cell, same types, warm — no second bill.
    await searchNearbyPlaces("k", CENTER, { types: ["restaurant"], pull: 20 });
    assertEquals(n, 1);
    assertEquals(
      peekCachedNearbyPlaces(CENTER, ["restaurant"], 20)?.length,
      1,
    );
    // A 20-row cell is NOT an answer to a 60 pull, so it must not be served
    // as one: the operator raised the stop to get more places.
    assertEquals(peekCachedNearbyPlaces(CENTER, ["restaurant"], 60), null);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("mergeNearbyCatalog: Google pull backfills with Mesita up to pinCount", () => {
  const mesitaOnly = Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.67005 + i * 0.0001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) =>
    nearbyHit(`g${i}`, 25.67005 + i * 0.0001, -100.3)
  );
  const got = mergeNearbyCatalog(mesitaOnly, google, CENTER, {
    mesitaCount: 60,
    googleCount: 20,
  });
  assertEquals(got.length, 60);
  assertEquals(got.filter((x) => x.kind === "google").length, 20);
  assertEquals(got.filter((x) => x.kind === "listed").length, 40);
});

Deno.test("lanesForPlacesScope: the Google lane cap follows the operator pull", () => {
  // The guest's How many still caps pins; the operator's pull caps what we
  // buy. 60 pins with a 20 pull is 20 Google rows, exactly as before.
  assertEquals(lanesForPlacesScope("google", 60).googleCount, GOOGLE_NEARBY_MAX);
  assertEquals(lanesForPlacesScope("google", 60, 60).googleCount, 60);
  assertEquals(lanesForPlacesScope("google", 20, 60).googleCount, 20);
  assertEquals(lanesForPlacesScope("mesita", 60, 60).googleCount, 0);
});


const LEGACY_OK_BODY = (placeId = "ChIJ-ok", next?: string) =>
  JSON.stringify({
    status: "OK",
    results: [{
      place_id: placeId,
      name: "Ok Cafe",
      vicinity: "1 Main",
      geometry: { location: { lat: 25.67, lng: -100.3 } },
      types: ["restaurant"],
    }],
    next_page_token: next,
  });

// MESITA-1700, both halves. Pagination must not cache a short answer, and the
// quota ledger counts billed pages, not pulls.
Deno.test("searchNearbyPlaces: a partial pull is NOT cached", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    n++;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("nearbysearch/json")) {
      return Promise.resolve(new Response("unexpected", { status: 500 }));
    }
    const page = url.includes("pagetoken=page1") ? 1 : 0;
    if (page === 1) return Promise.resolve(new Response("boom", { status: 500 }));
    return Promise.resolve(
      new Response(LEGACY_OK_BODY(`ChIJ-${page}`, "page1"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    __setLegacyPageTokenDelayForTests(0);
    const types = ["restaurant", "cafe", "bakery"];
    const first = await searchNearbyPlaces("k", CENTER, { types, pull: 60 });
    assertEquals(n, 2);
    assertEquals(first.length, 1);
    assertEquals(peekCachedNearbyPlaces(CENTER, types, 60), null);
    await searchNearbyPlaces("k", CENTER, { types, pull: 60 });
    assertEquals(n, 4);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: the quota is charged per BILLED CALL", async () => {
  __resetNearbyGoogleCacheForTests();
  let calls = 0;
  let charges = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    calls++;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("nearbysearch/json")) {
      return Promise.resolve(new Response("unexpected", { status: 500 }));
    }
    const next = calls < 3 ? `page${calls}` : undefined;
    return Promise.resolve(
      new Response(LEGACY_OK_BODY(`ChIJ-${calls}`, next), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    __setLegacyPageTokenDelayForTests(0);
    await searchNearbyPlaces("k", CENTER, {
      types: ["restaurant", "cafe", "bakery"],
      pull: 60,
      beforeFanout: () => {
        charges++;
        return Promise.resolve(true);
      },
    });
    assertEquals(calls, 3);
    assertEquals(charges, 3);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: a mid-pull quota denial truncates, keeps, and does not cache", async () => {
  __resetNearbyGoogleCacheForTests();
  let calls = 0;
  let charges = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    calls++;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("nearbysearch/json")) {
      return Promise.resolve(new Response("unexpected", { status: 500 }));
    }
    return Promise.resolve(
      new Response(LEGACY_OK_BODY("ChIJ-ok", "page1"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    __setLegacyPageTokenDelayForTests(0);
    const types = ["restaurant", "cafe", "bakery"];
    const hits = await searchNearbyPlaces("k", CENTER, {
      types,
      pull: 60,
      beforeFanout: () => Promise.resolve(++charges === 1),
    });
    assertEquals(calls, 1);
    assertEquals(charges, 2);
    assertEquals(hits.length, 1);
    assertEquals(peekCachedNearbyPlaces(CENTER, types, 60), null);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("list-places admits every Mesita row through the scope, on the scoped filters (MESITA-2158)", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-list-places/index.ts", import.meta.url),
  );
  // The scan, the owned-gid pick and the extra query all ask the one rule.
  assertEquals(src.split("admitsScopeRow(placesScope, row)").length - 1, 3);
  assertEquals(src.includes("isEnrichedListedRow("), false);
  // The Mesita lane is Mesita Selected: the Enriched gate is always on
  // (MESITA-2298); the ready half binds in SQL as well.
  assertEquals(
    src.includes("listedMapFilters(cfg.filters, cfg.map)"),
    true,
  );
  assertEquals(src.split("readyOnMap(applyGeneralGateQuery(").length - 1, 2);
});
