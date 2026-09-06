import { assertEquals } from "jsr:@std/assert@1";
import { NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import {
  __resetNearbyGoogleCacheForTests,
  CATALOG_NEARBY_HARD_MAX,
  GOOGLE_FANOUT_MAX,
  GOOGLE_NEARBY_MAX,
  NEARBY_TYPES,
  parsePlacesScope,
  dropKnownMesitaGoogleHits,
  isEnrichedListedRow,
  keepListedForScope,
  listedGooglePlaceIds,
  lanesForPlacesScope,
  mergeNearbyCatalog,
  peekCachedNearbyPlaces,
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

Deno.test("Nearby type batteries stay in lockstep with discovery_config.map", () => {
  assertEquals([...NEARBY_TYPES], [...NEARBY_TYPE_KEYS]);
});

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
  // The Places ring is applied by keepListedForScope BEFORE the merge, so
  // this function stays a pure closest-N: the closest rows handed to it
  // win regardless of plan.
  const mesita = [
    { id: "np-close", plan: "free", google_place_id: "np", lat: 25.67005, lng: -100.30005 },
    { id: "p-far", plan: "pro", google_place_id: "p", lat: 25.8, lng: -100.3 },
  ];
  const got = mergeNearbyCatalog(mesita, [], CENTER, SCOPE_MESITA);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["np-close", "p-far"],
  );
});

Deno.test("mergeNearbyCatalog: Mesita set includes partners in the same N", () => {
  const mesita = [
    { id: "p1", plan: "pro", google_place_id: "p1", lat: 25.6701, lng: -100.3001 },
    { id: "m1", plan: "free", google_place_id: "m1", lat: 25.6702, lng: -100.3002 },
  ];
  const got = mergeNearbyCatalog(mesita, [], CENTER, SCOPE_MESITA);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["p1", "m1"],
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

Deno.test("mergeNearbyCatalog: disjoint scopes stay 20 on Google, not 40", () => {
  const partners = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    plan: "pro",
    google_place_id: `p${i}`,
    lat: 25.85 + i * 0.0001,
    lng: -100.3,
  }));
  const mesitaOnly = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.75 + i * 0.0001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) =>
    nearbyHit(`g${i}`, 25.67005 + i * 0.0001, -100.3)
  );
  const got = mergeNearbyCatalog([...partners, ...mesitaOnly], google, CENTER, SCOPE_GOOGLE);
  assertEquals(got.length, 20);
  assertEquals(got.every((x) => x.kind === "google"), true);
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

Deno.test("mergeNearbyCatalog: Mesita set of 20 mixes partners into that N", () => {
  const partners = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    plan: "pro",
    google_place_id: `p${i}`,
    lat: 25.67001 + i * 0.0001,
    lng: -100.3,
  }));
  const extra = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.672 + i * 0.0001,
    lng: -100.3,
  }));
  const got = mergeNearbyCatalog([...partners, ...extra], [], CENTER, SCOPE_MESITA);
  assertEquals(got.length, 20);
  assertEquals(got.every((x) => x.kind === "listed"), true);
  assertEquals(
    got.filter((x) => x.kind === "listed" && x.row.plan === "pro").length,
    8,
  );
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
    assertEquals(body.includedPrimaryTypes, [...NEARBY_TYPES]);
    assertEquals(body.maxResultCount, GOOGLE_NEARBY_MAX);
    assertEquals(body.rankPreference, "DISTANCE");
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: HTTP failure is not cached", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(new Response("fail", { status: 500 }));
  };
  try {
    const a = await searchNearbyPlaces("k", CENTER);
    const b = await searchNearbyPlaces("k", CENTER);
    assertEquals(a, []);
    assertEquals(b, []);
    assertEquals(n, 2);
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

Deno.test("places scope: three nested sets, named on the wire, widest-Mesita default", () => {
  // The absent value is the one that matters most: mobile Search and the
  // web Pay picker both post no scope, so it must never be the narrowest
  // ring. "mesita" is the widest Mesita set.
  assertEquals(parsePlacesScope(undefined), "mesita");
  assertEquals(parsePlacesScope(null), "mesita");
  assertEquals(parsePlacesScope(""), "mesita");
  assertEquals(parsePlacesScope("nope"), "mesita");
  assertEquals(parsePlacesScope({}), "mesita");
  assertEquals(parsePlacesScope("partners"), "partners");
  assertEquals(parsePlacesScope("MESITA"), "mesita");
  assertEquals(parsePlacesScope(" google "), "google");
  // Legacy ordinals keep their OLD shipped meanings, so a client deployed
  // before this EF still gets the set it asked for during the skew window.
  assertEquals(parsePlacesScope(1), "mesita");
  assertEquals(parsePlacesScope(2), "google");
  assertEquals(parsePlacesScope(3), "google");
  assertEquals(parsePlacesScope("2"), "google");

  // Lane caps are the GUEST's How many, never a console knob. Only the
  // Google ring opens the Google lane — the two Mesita rings never do.
  assertEquals(lanesForPlacesScope("partners", 20), { mesitaCount: 20, googleCount: 0 });
  assertEquals(lanesForPlacesScope("mesita", 20), { mesitaCount: 20, googleCount: 0 });
  assertEquals(lanesForPlacesScope("google", 20), { mesitaCount: 20, googleCount: 20 });
  // Google's own Nearby call tops out at 20 however large How many is.
  assertEquals(lanesForPlacesScope("google", 60), { mesitaCount: 60, googleCount: 20 });
  // Garbage and overshoot clamp to the largest How many stop.
  assertEquals(lanesForPlacesScope("google", 999).mesitaCount, CATALOG_NEARBY_HARD_MAX);
  assertEquals(lanesForPlacesScope("mesita", Number.NaN).mesitaCount, 0);

  assertEquals(isEnrichedListedRow({ content_state: "ready" }), true);
  assertEquals(isEnrichedListedRow({ enriched_at: "2026-08-01T00:00:00Z" }), true);
  assertEquals(isEnrichedListedRow({ content_state: "queued" }), false);
  assertEquals(isEnrichedListedRow({}), false);
});

// THE TEST THAT PROVES THE RINGS ARE REAL.
//
// Every live row is plan='pro' AND content_state='ready' (22/22, measured
// 2026-09-05), so on production-shaped data all three rings hold the same
// places and a green suite proves nothing. These two cells do not exist in
// production and are exactly what separates the rings:
//
//   partner_not_enriched  pro  + queued  → in NO Mesita ring (gray)
//   enriched_not_partner  free + ready   → in Enriched, NOT in Partner
//
// If either row cannot be constructed, the three rings are not three sets.
Deno.test("places scope: the three rings return three DIFFERENT sets", () => {
  const partnerAndEnriched = { id: "pe", plan: "pro", content_state: "ready" };
  const enrichedNotPartner = { id: "ep", plan: "free", content_state: "ready" };
  const partnerNotEnriched = { id: "pn", plan: "pro", content_state: "queued" };
  const stub = { id: "st", plan: "free", content_state: "queued" };
  const catalog = [partnerAndEnriched, enrichedNotPartner, partnerNotEnriched, stub];

  const ring = (scope: "partners" | "mesita" | "google") =>
    catalog.filter((row) => keepListedForScope(row, scope)).map((row) => row.id);

  // Enrichment gates EVERY Mesita ring (Pato, 2026-09-05), so an
  // unenriched partner is in neither — it reads gray until enriched.
  assertEquals(ring("partners"), ["pe"]);
  assertEquals(ring("mesita"), ["pe", "ep"]);
  // A wider ring never shows FEWER Mesita places; Google rows arrive
  // alongside these, never instead of them.
  assertEquals(ring("google"), ["pe", "ep"]);

  // Partner ⊂ Enriched — the containment the diagram draws, now enforced.
  const partners = new Set(ring("partners"));
  assertEquals(ring("mesita").filter((id) => partners.has(id)), ["pe"]);
  assertEquals(partners.has("pn"), false);

  // And the sets genuinely differ, which is the whole point of the control.
  assertEquals(ring("partners").length < ring("mesita").length, true);
});

Deno.test("places scope: an absent scope returns today's set, for Pay and mobile", () => {
  // apps/mobile-consumer/src/lib/api/places.ts and the web Pay picker
  // (PlacePickList) post { lat, lng, limit } with no scope. Whatever the
  // default resolves to, it must not narrow what those two callers see.
  const rows = [
    { id: "pe", plan: "pro", content_state: "ready" },
    { id: "ep", plan: "free", content_state: "ready" },
    { id: "st", plan: "free", content_state: "queued" },
  ];
  const absent = rows.filter((row) =>
    keepListedForScope(row, parsePlacesScope(undefined))
  ).map((row) => row.id);
  const explicitMesita = rows.filter((row) => keepListedForScope(row, "mesita"))
    .map((row) => row.id);
  assertEquals(absent, explicitMesita);
  assertEquals(absent, ["pe", "ep"]);
  // The default is never the narrowest ring — that is the whole guard.
  assertEquals(parsePlacesScope(undefined) === "partners", false);
});

Deno.test("nearby helpers: known-gid drop still works", () => {
  const createdGids = listedGooglePlaceIds([
    { google_place_id: "ChIJ-created" },
    { google_place_id: null },
  ]);
  assertEquals(
    dropKnownMesitaGoogleHits(
      [
        { placeId: "ChIJ-created" },
        { placeId: "ChIJ-google" },
      ],
      createdGids,
    ).map((hit) => hit.placeId),
    ["ChIJ-google"],
  );
});
