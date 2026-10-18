import { assertEquals } from "jsr:@std/assert@1";
import { NEARBY_TYPE_KEYS } from "./discovery-config.ts";
import {
  __resetNearbyGoogleCacheForTests,
  GOOGLE_FANOUT_MAX,
  GOOGLE_NEARBY_MAX,
  nearbyRadiusMetres,
  parsePlacesScope,
  peekCachedNearbyPlaces,
  PLACES_SCOPE_DEFAULT,
  type PlacesScope,
  searchNearbyPlaces,
} from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

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
  let mask = "";
  let body: {
    includedPrimaryTypes?: string[];
    maxResultCount?: number;
    rankPreference?: string;
    locationRestriction?: { circle?: { radius?: number } };
  } = {};
  const orig = globalThis.fetch;
  globalThis.fetch = (_url, init) => {
    n++;
    mask = new Headers(init?.headers).get("X-Goog-FieldMask") ?? "";
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
    // The operator's circle; 50 km when none is given.
    assertEquals(body.locationRestriction?.circle?.radius, 50_000);
    // THE ONE mask (Search and Feed): open-now rides it for the timing
    // boost, userRatingCount feeds the floors, and never a photo field —
    // an ephemeral card draws its family emoji (MESITA-2298 §6).
    const fields = mask.split(",");
    assertEquals(fields.includes("places.currentOpeningHours.openNow"), true);
    assertEquals(fields.includes("places.userRatingCount"), true);
    assertEquals(fields.includes("places.rating"), true);
    assertEquals(mask.includes("places.photos"), false);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: the operator's radius is the circle and part of the cell (MESITA-2305)", async () => {
  __resetNearbyGoogleCacheForTests();
  const radii: number[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      locationRestriction?: { circle?: { radius?: number } };
    };
    radii.push(body.locationRestriction?.circle?.radius ?? -1);
    return Promise.resolve(
      new Response(OK_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const types = ["restaurant"];
    await searchNearbyPlaces("k", CENTER, { types, radiusKm: 12 });
    await searchNearbyPlaces("k", CENTER, { types, radiusKm: 12 });
    await searchNearbyPlaces("k", CENTER, { types });
    await searchNearbyPlaces("k", CENTER, { types, radiusKm: 999 });
    await searchNearbyPlaces("k", CENTER, { types, radiusKm: 0.01 });
    // 12 km is one cell (one call); 50 km (omitted) is another; 999 clamps
    // to Google's 50 km cap and shares that cell; 0.01 km clamps to 50 m.
    assertEquals(radii, [12_000, 50_000, 50]);
    assertEquals(peekCachedNearbyPlaces(CENTER, types, 12)?.length, 1);
    assertEquals(peekCachedNearbyPlaces(CENTER, types, 7), null);
    // The 50 km cell is warm too; a radius is the operator's, never read
    // off a client, and garbage reads as the 50 km cap.
    assertEquals(peekCachedNearbyPlaces(CENTER, types)?.length, 1);
    assertEquals(nearbyRadiusMetres(undefined), 50_000);
    assertEquals(nearbyRadiusMetres(Number.NaN), 50_000);
    assertEquals(nearbyRadiusMetres(80), 50_000);
    assertEquals(nearbyRadiusMetres(2.5), 2_500);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: openNow rides every hit; Google's silence is null (MESITA-2302)", async () => {
  __resetNearbyGoogleCacheForTests();
  const orig = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          places: [
            { id: "places/open", displayName: { text: "Open" }, currentOpeningHours: { openNow: true } },
            { id: "places/shut", displayName: { text: "Shut" }, currentOpeningHours: { openNow: false } },
            { id: "places/mute", displayName: { text: "Mute" } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  try {
    const hits = await searchNearbyPlaces("k", CENTER);
    assertEquals(
      hits.map((h) => [h.placeId, h.openNow]),
      [["open", true], ["shut", false], ["mute", null]],
    );
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
    // A cell none of the warm-up calls filled (they span lat 10..10+cap).
    const got = await searchNearbyPlaces("k", { lat: -40, lng: -100.3 }, {
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

Deno.test("places scope: two guest words on the wire, Mesita Selected by default (MESITA-2298)", () => {
  // The absent value is the one that matters most: any caller that posts no
  // scope lands on it, so it must be the Mesita set, never a paid call.
  assertEquals(PLACES_SCOPE_DEFAULT, "selected");
  assertEquals(parsePlacesScope(undefined), "selected");
  assertEquals(parsePlacesScope(null), "selected");
  assertEquals(parsePlacesScope(""), "selected");
  assertEquals(parsePlacesScope("nope"), "selected");
  assertEquals(parsePlacesScope({}), "selected");
  // The guest's two words, trimmed and case-insensitive.
  assertEquals(parsePlacesScope(" Selected "), "selected");
  assertEquals(parsePlacesScope(" google "), "google");
  // The retired words — the Enriched filter, the Created-rows ring and an
  // old client's `partners` — land on Selected, the enriched, ready set.
  // There is no wider Mesita scope and no Enriched filter any more.
  assertEquals(parsePlacesScope(" Enriched "), "selected");
  assertEquals(parsePlacesScope("MESITA"), "selected");
  assertEquals(parsePlacesScope("partners"), "selected");
  // Legacy ordinals keep their OLD shipped meanings, so a client deployed
  // before this EF still gets the set it asked for during the skew window.
  assertEquals(parsePlacesScope(1), "selected");
  assertEquals(parsePlacesScope(2), "google");
  assertEquals(parsePlacesScope(3), "google");
  assertEquals(parsePlacesScope("2"), "google");
  // The type has exactly these two members; both parse to themselves.
  const scopes: PlacesScope[] = ["google", "selected"];
  assertEquals(scopes.map((scope) => parsePlacesScope(scope)), scopes);
});

Deno.test("searchNearbyPlaces: one call, charged once, and a quota denial caches nothing (MESITA-2298)", async () => {
  __resetNearbyGoogleCacheForTests();
  const orig = globalThis.fetch;
  let calls = 0;
  let charges = 0;
  globalThis.fetch = (input: string | URL | Request) => {
    calls += 1;
    const url = String(input instanceof Request ? input.url : input);
    assertEquals(url.includes("maps.googleapis.com/maps/api/place/nearbysearch"), false);
    return Promise.resolve(
      new Response(JSON.stringify({ places: [{ id: "ChIJ-one", displayName: { text: "One" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  try {
    const types = ["restaurant", "cafe", "bakery"];
    // Denied: no Google call, nothing cached, the next request asks again.
    const denied = await searchNearbyPlaces("k", CENTER, {
      types,
      beforeFanout: () => Promise.resolve(++charges > 1),
    });
    assertEquals(denied, []);
    assertEquals(calls, 0);
    assertEquals(peekCachedNearbyPlaces(CENTER, types), null);
    // Allowed: exactly one billed call for the cell, then the cell is warm.
    const hits = await searchNearbyPlaces("k", CENTER, {
      types,
      beforeFanout: () => Promise.resolve(++charges > 1),
    });
    assertEquals(hits.length, 1);
    assertEquals(calls, 1);
    assertEquals(charges, 2);
    assertEquals(peekCachedNearbyPlaces(CENTER, types)?.length, 1);
    await searchNearbyPlaces("k", CENTER, { types, beforeFanout: () => Promise.resolve(++charges > 1) });
    assertEquals(calls, 1);
    assertEquals(charges, 2);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});


Deno.test("searchNearbyPlaces: a Google 5xx is retried once, then the hits land (MESITA-2361)", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(
      n === 1
        ? new Response("{\"error\":{\"status\":\"INTERNAL\"}}", { status: 500 })
        : new Response(OK_BODY, { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  };
  try {
    const hits = await searchNearbyPlaces("k", CENTER);
    assertEquals(n, 2);
    assertEquals(hits.map((h) => h.placeId), ["ChIJ-ok"]);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});

Deno.test("searchNearbyPlaces: a 4xx is never retried (MESITA-2361)", async () => {
  __resetNearbyGoogleCacheForTests();
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = () => {
    n++;
    return Promise.resolve(new Response("{}", { status: 400 }));
  };
  try {
    const hits = await searchNearbyPlaces("k", CENTER);
    assertEquals(n, 1);
    assertEquals(hits, []);
  } finally {
    globalThis.fetch = orig;
    __resetNearbyGoogleCacheForTests();
  }
});
