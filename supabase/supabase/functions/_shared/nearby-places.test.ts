import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_MAP, NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import {
  __resetNearbyGoogleCacheForTests,
  CATALOG_NEARBY_MAX,
  GOOGLE_FANOUT_MAX,
  GOOGLE_NEARBY_MAX,
  MESITA_NEARBY_MAX,
  NEARBY_TYPES,
  clampSearchPower,
  dropKnownMesitaGoogleHits,
  isEnrichedListedRow,
  keepListedForSearchPower,
  listedGooglePlaceIds,
  lanesForSearchPower,
  mergeNearbyCatalog,
  peekCachedNearbyPlaces,
  searchNearbyPlaces,
  type NearbyLaneCaps,
} from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };
const LANES_20: NearbyLaneCaps = {
  partnerCount: 0,
  mesitaCount: 20,
  googleCount: 20,
};

Deno.test("Nearby type batteries stay in lockstep with discovery_config.map", () => {
  assertEquals([...NEARBY_TYPES], [...NEARBY_TYPE_KEYS]);
});

Deno.test("mergeNearbyCatalog: Mesita row wins the same Google Place ID", () => {
  const mesita = [
    { id: "m1", google_place_id: "ChIJ1", lat: 25.6701, lng: -100.3001 },
    { id: "m2", google_place_id: "ChIJ2", lat: 25.68, lng: -100.31 },
  ];
  const google = [
    {
      placeId: "ChIJ1",
      name: "Dup",
      address: "",
      lat: 25.6701,
      lng: -100.3001,
      rating: 4,
      primaryType: "restaurant",
    },
    {
      placeId: "ChIJ9",
      name: "Google only",
      address: "",
      lat: 25.6702,
      lng: -100.3002,
      rating: 4.2,
      primaryType: "bar",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(
    got.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["m1", "m2"],
  );
  assertEquals(
    got.filter((x) => x.kind === "google").map((x) =>
      x.kind === "google" ? x.hit.placeId : ""
    ),
    ["ChIJ9"],
  );
});

Deno.test("mergeNearbyCatalog: Google-only fills beside every Mesita top-20", () => {
  const mesita = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `gid-${i}`,
    lat: 25.67 + i * 0.01,
    lng: -100.3,
  }));
  const google = Array.from({ length: 5 }, (_, i) => ({
    placeId: `gOnly-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67005 + i * 0.0001,
    lng: -100.3,
    rating: null,
    primaryType: "cafe",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(got.length, 8);
  assertEquals(got.filter((x) => x.kind === "listed").length, 3);
  assertEquals(got.filter((x) => x.kind === "google").length, 5);
});

Deno.test("mergeNearbyCatalog: an older close Mesita row still beats Google", () => {
  const mesita = [
    { id: "old-close", google_place_id: "ChIJ-old", lat: 25.67005, lng: -100.30005 },
  ];
  const google = [
    {
      placeId: "ChIJ-old",
      name: "Should not stub",
      address: "",
      lat: 25.67005,
      lng: -100.30005,
      rating: 4,
      primaryType: "restaurant",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
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
    {
      placeId: "g-close",
      name: "Close",
      address: "",
      lat: 25.6702,
      lng: -100.3002,
      rating: null,
      primaryType: "cafe",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["inside", "g-close"],
  );
});

Deno.test("mergeNearbyCatalog: partners then Mesita then Google", () => {
  const mesita = [
    { id: "np-close", plan: "free", google_place_id: "np", lat: 25.67005, lng: -100.30005 },
    { id: "p-far", plan: "pro", google_place_id: "p", lat: 25.8, lng: -100.3 },
  ];
  const google = [
    {
      placeId: "g-closest",
      name: "G",
      address: "",
      lat: 25.67001,
      lng: -100.30001,
      rating: null,
      primaryType: "cafe",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["p-far", "np-close", "g-closest"],
  );
});

Deno.test("mergeNearbyCatalog: a partner in the Mesita lane appears once", () => {
  const mesita = [
    { id: "p1", plan: "pro", google_place_id: "p1", lat: 25.6701, lng: -100.3001 },
    { id: "m1", plan: "free", google_place_id: "m1", lat: 25.6702, lng: -100.3002 },
  ];
  const google = [
    {
      placeId: "p1",
      name: "Also Google",
      address: "",
      lat: 25.6701,
      lng: -100.3001,
      rating: null,
      primaryType: "restaurant",
    },
  ];
  const got = mergeNearbyCatalog(mesita, google, CENTER);
  assertEquals(
    got.map((x) => x.kind === "listed" ? x.row.id : x.hit.placeId),
    ["p1", "m1"],
  );
});

Deno.test("mergeNearbyCatalog: nested 10+10+20 collapses to 20", () => {
  const partners = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    plan: "pro",
    google_place_id: `p${i}`,
    lat: 25.67 + i * 0.0001,
    lng: -100.3,
  }));
  const extraMesita = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `m${i}`,
    lat: 25.68 + i * 0.0001,
    lng: -100.3,
  }));
  const extraGoogle = Array.from({ length: 10 }, (_, i) => ({
    placeId: `g${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.69 + i * 0.0001,
    lng: -100.3,
    rating: null,
    primaryType: "cafe",
  }));
  const google = [
    ...partners.map((row) => ({
      placeId: row.google_place_id,
      name: row.id,
      address: "",
      lat: row.lat,
      lng: row.lng,
      rating: null,
      primaryType: "restaurant",
    })),
    ...extraGoogle,
  ];
  const got = mergeNearbyCatalog([...partners, ...extraMesita], google, CENTER);
  assertEquals(got.length, 20);
  assertEquals(
    got.slice(0, 10).map((x) => x.kind === "listed" ? x.row.id : ""),
    partners.map((row) => row.id),
  );
  assertEquals(
    got.slice(10).map((x) => x.kind === "google" ? x.hit.placeId : ""),
    extraGoogle.map((hit) => hit.placeId),
  );
});

Deno.test("mergeNearbyCatalog: disjoint lanes stay 40", () => {
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
  const google = Array.from({ length: 20 }, (_, i) => ({
    placeId: `g${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67005 + i * 0.0001,
    lng: -100.3,
    rating: null,
    primaryType: "cafe",
  }));
  const got = mergeNearbyCatalog([...partners, ...mesitaOnly], google, CENTER);
  assertEquals(got.length, 40);
  assertEquals(got.slice(0, 10).every((x) => x.kind === "listed"), true);
  assertEquals(got.slice(10, 20).every((x) => x.kind === "listed"), true);
  assertEquals(got.slice(20).every((x) => x.kind === "google"), true);
  assertEquals(
    got.slice(0, 10).map((x) => x.kind === "listed" ? x.row.id : ""),
    partners.map((row) => row.id),
  );
});

Deno.test("mergeNearbyCatalog: a Mesita miss does not come back as a Google stub", () => {
  const mesita = Array.from({ length: 15 }, (_, i) => ({
    id: `m${i}`,
    plan: "free",
    google_place_id: `shared-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const google = mesita.map((row, i) => ({
    placeId: row.google_place_id,
    name: `G${i}`,
    address: "",
    lat: row.lat,
    lng: row.lng,
    rating: null,
    primaryType: "bar",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER);
  assertEquals(got.length, 10);
  assertEquals(got.every((x) => x.kind === "listed"), true);
});

Deno.test("mergeNearbyCatalog: union is 20 when Mesita and Google agree", () => {
  const mesita = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `shared-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) => ({
    placeId: `shared-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67 + i * 0.001,
    lng: -100.3,
    rating: null,
    primaryType: "bar",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(got.length, MESITA_NEARBY_MAX);
  assertEquals(got.every((x) => x.kind === "listed"), true);
});

Deno.test("mergeNearbyCatalog: union is 40 when the two queries miss", () => {
  const mesita = Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `mid-${i}`,
    lat: 25.67 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 30 }, (_, i) => ({
    placeId: `g-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67 + i * 0.002,
    lng: -100.31,
    rating: null,
    primaryType: "bar",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(got.filter((x) => x.kind === "listed").length, MESITA_NEARBY_MAX);
  assertEquals(got.filter((x) => x.kind === "google").length, GOOGLE_NEARBY_MAX);
  assertEquals(got.length, CATALOG_NEARBY_MAX);
});

Deno.test("mergeNearbyCatalog: far Mesita still keeps its 20 vs closer Google", () => {
  const mesita = Array.from({ length: 20 }, (_, i) => ({
    id: `m${i}`,
    google_place_id: `far-${i}`,
    lat: 25.85 + i * 0.001,
    lng: -100.3,
  }));
  const google = Array.from({ length: 20 }, (_, i) => ({
    placeId: `near-${i}`,
    name: `G${i}`,
    address: "",
    lat: 25.67005 + i * 0.0001,
    lng: -100.3,
    rating: null,
    primaryType: "cafe",
  }));
  const got = mergeNearbyCatalog(mesita, google, CENTER, LANES_20);
  assertEquals(got.filter((x) => x.kind === "listed").length, 20);
  assertEquals(got.filter((x) => x.kind === "google").length, 20);
  assertEquals(got.slice(0, 20).every((x) => x.kind === "listed"), true);
  assertEquals(got.slice(20).every((x) => x.kind === "google"), true);
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

Deno.test("search power zeros unused lanes and treats Mesita Places as enriched", () => {
  assertEquals(clampSearchPower(undefined), 2);
  assertEquals(clampSearchPower(1), 1);
  assertEquals(lanesForSearchPower(DEFAULT_MAP, 1).mesitaCount, 0);
  assertEquals(lanesForSearchPower(DEFAULT_MAP, 1).googleCount, 0);
  assertEquals(lanesForSearchPower(DEFAULT_MAP, 2).googleCount, 0);
  assertEquals(lanesForSearchPower(DEFAULT_MAP, 2).mesitaCount, DEFAULT_MAP.mesitaCount);
  assertEquals(lanesForSearchPower(DEFAULT_MAP, 3).googleCount, DEFAULT_MAP.googleCount);
  assertEquals(isEnrichedListedRow({ content_status: "ready" }), true);
  assertEquals(isEnrichedListedRow({ enriched_at: "2026-08-01T00:00:00Z" }), true);
  assertEquals(isEnrichedListedRow({ content_status: "queued" }), false);
  assertEquals(isEnrichedListedRow({}), false);
  assertEquals(keepListedForSearchPower({ id: "p", partner: true }, 1), true);
  assertEquals(
    keepListedForSearchPower({ id: "e", plan: "free", content_status: "ready" }, 1),
    false,
  );
  assertEquals(
    keepListedForSearchPower({ id: "e", plan: "free", content_status: "ready" }, 2),
    true,
  );
  assertEquals(
    keepListedForSearchPower({ id: "c", plan: "free", content_status: "queued" }, 3),
    false,
  );
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
