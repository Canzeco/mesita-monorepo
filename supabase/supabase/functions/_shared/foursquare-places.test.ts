import { assertEquals } from "jsr:@std/assert@1";
import {
  foursquareIdFromUrl,
  foursquareVenueUrl,
  pickFoursquareMatch,
  planFoursquare,
  type FoursquareRow,
} from "./foursquare-places.ts";

const HERE = { name: "Cafe Roma", lat: 25.67, lng: -100.31, address: "120 Hidalgo" };

function place(id: string, name: string, lat: number, lng: number, address: string | null) {
  return { id, name, lat, lng, address };
}

Deno.test("a close branch with the same name and street number matches; a far one, a wrong number, and two close chains do not", () => {
  const close = place("abc", "Café Roma", 25.6702, -100.31, "120 Hidalgo");
  assertEquals(pickFoursquareMatch(HERE, [close])?.id, "abc");
  const far = place("far", "Cafe Roma", 25.68, -100.31, "120 Hidalgo");
  assertEquals(pickFoursquareMatch(HERE, [far]), null);
  const otherDoor = place("door", "Cafe Roma", 25.6702, -100.31, "400 Hidalgo");
  assertEquals(pickFoursquareMatch(HERE, [otherDoor]), null);
  const twin = place("twin", "Cafe Roma", 25.6703, -100.3101, "120 Hidalgo");
  assertEquals(pickFoursquareMatch(HERE, [close, twin]), null);
});

Deno.test("the venue link is the public page, and an existing link yields its id", () => {
  assertEquals(foursquareVenueUrl("abc"), "https://foursquare.com/v/abc");
  assertEquals(foursquareIdFromUrl("https://foursquare.com/v/cafe-roma/abc123"), "abc123");
  assertEquals(foursquareIdFromUrl("https://foursquare.com/v/abc123"), "abc123");
  assertEquals(foursquareIdFromUrl(null), null);
});

function http(routes: Record<string, { status?: number; body: unknown }>): typeof fetch {
  return ((url: string) => {
    const path = url.replace("https://places-api.foursquare.com", "");
    const hit = Object.entries(routes).find(([key]) => path.startsWith(key));
    if (!hit) return Promise.resolve(new Response("missing", { status: 404 }));
    const route = hit[1];
    return Promise.resolve(new Response(JSON.stringify(route.body), { status: route.status ?? 200 }));
  }) as typeof fetch;
}

const LINKED: FoursquareRow = {
  name: "Cafe Roma",
  lat: 25.67,
  lng: -100.31,
  address: "120 Hidalgo",
  foursquare_place_id: "abc",
  foursquare_url: "https://foursquare.com/v/abc",
  foursquare_popularity: 0.4,
};

Deno.test("a linked place refreshes popularity only, and a failed refresh writes nothing", async () => {
  const ok = await planFoursquare(LINKED, http({ "/places/abc": { body: { popularity: 0.95 } } }), "key");
  assertEquals(ok.action, "write");
  if (ok.action === "write") {
    assertEquals(ok.patch.foursquare_place_id, "abc");
    assertEquals(ok.patch.foursquare_popularity, 0.95);
    assertEquals(ok.patch.foursquare_url, "https://foursquare.com/v/abc");
  }
  const failed = await planFoursquare(LINKED, http({ "/places/abc": { status: 500, body: {} } }), "key");
  assertEquals(failed.action, "preserve");
});

Deno.test("an unlinked place searches once, saves a confirmed branch, and leaves a tie unmatched", async () => {
  const search = {
    results: [{
      fsq_place_id: "abc",
      name: "Cafe Roma",
      latitude: 25.6702,
      longitude: -100.31,
      location: { address: "120 Hidalgo" },
    }],
  };
  const saved = await planFoursquare(
    { ...LINKED, foursquare_place_id: null, foursquare_url: null, foursquare_popularity: null },
    http({
      "/places/search": { body: search },
      "/places/abc": { body: { popularity: 0.2 } },
    }),
    "key",
  );
  assertEquals(saved.action, "write");
  if (saved.action === "write") assertEquals(saved.patch.foursquare_popularity, 0.2);
  const tie = await planFoursquare(
    { ...LINKED, foursquare_place_id: null, foursquare_url: null },
    http({
      "/places/search": {
        body: {
          results: [
            search.results[0],
            { ...search.results[0], fsq_place_id: "other", latitude: 25.6703 },
          ],
        },
      },
    }),
    "key",
  );
  assertEquals(tie.action, "unmatched");
});
