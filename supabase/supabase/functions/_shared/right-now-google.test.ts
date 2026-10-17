import { assert, assertEquals } from "jsr:@std/assert@1";
import { __resetNearbyGoogleCacheForTests } from "./nearby-places.ts";
import {
  __resetRightNowPhotosForTests,
  rightNowGooglePlaces,
  type RightNowOwnedRow,
} from "./right-now-google.ts";
import { withGoogleRightNow } from "./catalog-rank.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

type GPlace = {
  id: string;
  lat: number;
  openNow?: boolean;
  status?: string;
  photo?: string;
};

function gPlace(p: GPlace) {
  return {
    id: `places/${p.id}`,
    displayName: { text: p.id },
    formattedAddress: "",
    location: { latitude: p.lat, longitude: CENTER.lng },
    rating: 4.5,
    userRatingCount: 100,
    businessStatus: p.status ?? "OPERATIONAL",
    primaryType: "restaurant",
    ...(p.openNow === undefined
      ? {}
      : { currentOpeningHours: { openNow: p.openNow } }),
    ...(p.photo ? { photos: [{ name: `places/${p.id}/photos/${p.photo}` }] } : {}),
  };
}

type Call = { url: string; mask: string | null };

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
    calls.push({ url, mask: headers.get("X-Goog-FieldMask") });
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
  __resetRightNowPhotosForTests();
}

function deps(
  over: Partial<Parameters<typeof rightNowGooglePlaces<RightNowOwnedRow>>[0]> =
    {},
) {
  let quotaCalls = 0;
  const d = {
    apiKey: "k",
    center: CENTER,
    consumeQuota: () => {
      quotaCalls++;
      return Promise.resolve(true);
    },
    lookupOwned: (_gids: string[]) => Promise.resolve([] as RightNowOwnedRow[]),
    ...over,
  };
  return { d, quota: () => quotaCalls };
}

const nearbyCalls = (calls: Call[]) =>
  calls.filter((c) => c.url.includes("places:searchNearby"));
const photoCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/media?"));

Deno.test("right now: keeps open + OPERATIONAL only, nearest first, at most 5", async () => {
  reset();
  const g = stubGoogle([
    { id: "far", lat: 25.679, openNow: true, photo: "p" },
    { id: "closed", lat: 25.6701, openNow: false, photo: "p" },
    { id: "unknown", lat: 25.6702, photo: "p" },
    { id: "shut", lat: 25.6703, openNow: true, status: "CLOSED_TEMPORARILY" },
    ...[1, 2, 3, 4, 5].map((i) => ({
      id: `o${i}`,
      lat: 25.67 + i * 0.001,
      openNow: true,
      photo: "p",
    })),
  ]);
  try {
    const { d, quota } = deps();
    const got = await rightNowGooglePlaces(d);
    assert(got);
    assertEquals(got.map((p) => p.slug), ["o1", "o2", "o3", "o4", "o5"]);
    assert(got.every((p) => p.googleOnly === true));
    assertEquals(got[0].photos, [
      "https://lh3.googleusercontent.com/places/o1/photos/p",
    ]);
    assertEquals(quota(), 1);
    assertEquals(nearbyCalls(g.calls).length, 1);
    assertEquals(photoCalls(g.calls).length, 5);
    const mask = nearbyCalls(g.calls)[0].mask ?? "";
    assert(mask.includes("places.currentOpeningHours.openNow"));
    assert(mask.includes("places.photos"));
  } finally {
    g.restore();
  }
});

Deno.test("right now: a hit Mesita owns goes out as the Mesita card", async () => {
  reset();
  const g = stubGoogle([
    { id: "mine", lat: 25.6701, openNow: true, photo: "p" },
    { id: "theirs", lat: 25.6702, openNow: true, photo: "p" },
  ]);
  try {
    let asked: string[] = [];
    const { d } = deps({
      lookupOwned: (gids) => {
        asked = gids;
        return Promise.resolve([{
          id: "m1",
          slug: "casa",
          name: "Casa",
          google_place_id: "mine",
          enriched_at: null,
          lat: 25.6701,
          lng: CENTER.lng,
          photos: ["https://example.com/a.jpg"],
        }]);
      },
    });
    const got = await rightNowGooglePlaces(d);
    assert(got);
    assertEquals(asked.sort(), ["mine", "theirs"]);
    assertEquals(got.map((p) => p.id), ["m1", "g:theirs"]);
    assertEquals(got[0].googleOnly, undefined);
    assertEquals("google_place_id" in got[0], false);
    assertEquals(got[0].photos, ["https://example.com/a.jpg"]);
    // Only the Google-only card buys a photo.
    assertEquals(photoCalls(g.calls).length, 1);
  } finally {
    g.restore();
  }
});

Deno.test("right now: no location or no key means no Google call (fallback)", async () => {
  reset();
  const g = stubGoogle([{ id: "o", lat: 25.6701, openNow: true }]);
  try {
    assertEquals(await rightNowGooglePlaces(deps({ center: null }).d), null);
    assertEquals(await rightNowGooglePlaces(deps({ apiKey: null }).d), null);
    assertEquals(g.calls.length, 0);
  } finally {
    g.restore();
  }
});

Deno.test("right now: a quota refusal means no Google call (fallback)", async () => {
  reset();
  const g = stubGoogle([{ id: "o", lat: 25.6701, openNow: true }]);
  try {
    const { d, quota } = deps({ consumeQuota: () => Promise.resolve(false) });
    assertEquals(await rightNowGooglePlaces(d), null);
    assertEquals(quota(), 0);
    assertEquals(g.calls.length, 0);
  } finally {
    g.restore();
  }
});

Deno.test("right now: a Google error falls back and is not cached", async () => {
  reset();
  const g = stubGoogle([{ id: "o", lat: 25.6701, openNow: true }], 500);
  try {
    assertEquals(await rightNowGooglePlaces(deps().d), null);
    assertEquals(await rightNowGooglePlaces(deps().d), null);
    // Not cached: each load retried (and each was metered).
    assertEquals(nearbyCalls(g.calls).length, 2);
  } finally {
    g.restore();
  }
});

Deno.test("right now: an owned-row lookup error falls back", async () => {
  reset();
  const g = stubGoogle([{ id: "o", lat: 25.6701, openNow: true }]);
  try {
    const got = await rightNowGooglePlaces(
      deps({ lookupOwned: () => Promise.resolve(null) }).d,
    );
    assertEquals(got, null);
  } finally {
    g.restore();
  }
});

Deno.test("right now: nothing open falls back", async () => {
  reset();
  const g = stubGoogle([{ id: "c", lat: 25.6701, openNow: false }]);
  try {
    assertEquals(await rightNowGooglePlaces(deps().d), null);
  } finally {
    g.restore();
  }
});

Deno.test("right now: a warm cell makes no Google call and spends no quota", async () => {
  reset();
  const g = stubGoogle([{ id: "o", lat: 25.6701, openNow: true, photo: "p" }]);
  try {
    const first = deps();
    await rightNowGooglePlaces(first.d);
    assertEquals(first.quota(), 1);
    const before = g.calls.length;
    const second = deps({ center: { lat: 25.6712, lng: -100.3004 } });
    const got = await rightNowGooglePlaces(second.d);
    assertEquals(got?.map((p) => p.slug), ["o"]);
    assertEquals(second.quota(), 0);
    assertEquals(g.calls.length, before);
  } finally {
    g.restore();
  }
});

Deno.test("withGoogleRightNow: replaces the Mesita Right Now, or keeps it on null", () => {
  const rails = [
    { key: "right_now", label: "Right Now", emoji: "🕒", source: "signal" as const, places: [{ id: "m" }] },
    { key: "universal", label: "Universal", emoji: "✨", source: "signal" as const, places: [{ id: "u" }] },
  ];
  assertEquals(withGoogleRightNow(rails, null), rails);
  assertEquals(withGoogleRightNow(rails, []), rails);
  const got = withGoogleRightNow(rails, [{ id: "g:a" }]);
  assertEquals(got.map((r) => r.key), ["right_now", "universal"]);
  assertEquals(got[0].places, [{ id: "g:a" }]);
  const opened = withGoogleRightNow([rails[1]], [{ id: "g:a" }]);
  assertEquals(opened.map((r) => r.key), ["right_now", "universal"]);
});
