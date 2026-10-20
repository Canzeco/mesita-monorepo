import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  cacheKey,
  geocodeStatus,
  NEARBY_AREAS_MAX,
  pickAreaName,
  pickFormattedAddress,
  pickNearbyAreas,
  pickSuggestedName,
  PIN_DECIMALS,
  pointKey,
  readPoint,
  readPrecision,
  reverseGeocodeUrl,
  snapPoint,
} from "./reverse-geocode.ts";

// MESITA-2466: Home's Current location row names the neighbourhood.

Deno.test("snaps a point to 3 decimals (~110 m), so one block shares one call", () => {
  assertEquals(snapPoint(25.651234, -100.289876), { lat: 25.651, lng: -100.29 });
  assertEquals(pointKey(snapPoint(25.651234, -100.289876)), "25.651,-100.290");
  assertEquals(pointKey(snapPoint(25.6514, -100.2902)), "25.651,-100.290");
});

Deno.test("reads only a finite, in-range point", () => {
  assertEquals(readPoint({ lat: 25.65, lng: -100.29 }), { lat: 25.65, lng: -100.29 });
  assertEquals(readPoint({ lat: "25", lng: -100 }), null);
  assertEquals(readPoint({ lat: Number.NaN, lng: 1 }), null);
  assertEquals(readPoint({ lat: 91, lng: 0 }), null);
  assertEquals(readPoint({ lng: 0 }), null);
});

Deno.test("picks the most local name: neighbourhood, then sublocality, then city", () => {
  const answer = {
    status: "OK",
    results: [
      {
        address_components: [
          { long_name: "Monterrey", types: ["locality", "political"] },
          { long_name: "Tecnológico", types: ["neighborhood", "political"] },
        ],
      },
    ],
  };
  assertEquals(pickAreaName(answer), "Tecnológico");
  assertEquals(
    pickAreaName({
      results: [
        { address_components: [{ long_name: "Centro", types: ["sublocality_level_1"] }] },
        { address_components: [{ long_name: "Monterrey", types: ["locality"] }] },
      ],
    }),
    "Centro",
  );
  assertEquals(
    pickAreaName({ results: [{ address_components: [{ long_name: "Monterrey", types: ["locality"] }] }] }),
    "Monterrey",
  );
});

Deno.test("skips Google's unnamed-block placeholder for the next level up", () => {
  // Seen live at 25.651,-100.290: the neighbourhood came back "Sin Nombre 34".
  assertEquals(
    pickAreaName({
      results: [
        {
          address_components: [
            { long_name: "Sin Nombre 34", types: ["neighborhood", "political"] },
            { long_name: "Monterrey", types: ["locality", "political"] },
          ],
        },
      ],
    }),
    "Monterrey",
  );
  assertEquals(
    pickAreaName({
      results: [{ address_components: [{ long_name: "Sin Nombre de Col 46", types: ["neighborhood"] }] }],
    }),
    null,
  );
});

Deno.test("no usable name is null, never a guess", () => {
  assertEquals(pickAreaName({ status: "ZERO_RESULTS", results: [] }), null);
  assertEquals(pickAreaName(null), null);
  assertEquals(pickAreaName({ results: [{ address_components: [{ long_name: " ", types: ["neighborhood"] }] }] }), null);
  assertEquals(pickAreaName({ results: [{ address_components: [{ long_name: "MX", types: ["country"] }] }] }), null);
});

Deno.test("reads Google's status and builds a Spanish, area-only request", () => {
  assertEquals(geocodeStatus({ status: "REQUEST_DENIED" }), "REQUEST_DENIED");
  assertEquals(geocodeStatus("x"), "INVALID");
  const url = new URL(reverseGeocodeUrl({ lat: 25.651, lng: -100.29 }, "k"));
  assertEquals(url.searchParams.get("latlng"), "25.651,-100.290");
  assertEquals(url.searchParams.get("language"), "es");
  assertEquals(
    url.searchParams.get("result_type"),
    "neighborhood|sublocality_level_1|sublocality|locality",
  );
});

// MESITA-2471: the sheet's "Around you" rows come from the same answer.
Deno.test("pickNearbyAreas: most local first, one per name, rectangles the Area pipeline takes", () => {
  const vp = (s: number, w: number, n: number, e: number) => ({
    southwest: { lat: s, lng: w },
    northeast: { lat: n, lng: e },
  });
  const r = (type: string, name: string, viewport: unknown) => ({
    types: [type, "political"],
    address_components: [{ long_name: name, types: [type, "political"] }],
    geometry: { location: { lat: 25.65, lng: -100.29 }, viewport },
  });
  const answer = {
    status: "OK",
    results: [
      r("locality", "Monterrey", vp(25.55, -100.45, 25.8, -100.15)),
      r("neighborhood", "Distrito Tec", vp(25.64, -100.3, 25.66, -100.28)),
      r("sublocality_level_1", "Sin Nombre de Col 46", vp(25.6, -100.3, 25.7, -100.2)),
      r("neighborhood", "distrito tec", vp(25.64, -100.3, 25.66, -100.28)),
      // Wider than 100 km: the Area pipeline would fall back to a point.
      r("locality", "Huge", vp(24, -101, 26, -99)),
      // Inverted rectangle.
      r("neighborhood", "Broken", vp(25.7, -100.2, 25.6, -100.3)),
      // Not an area level.
      r("route", "Av. Eugenio Garza Sada", vp(25.64, -100.3, 25.66, -100.28)),
    ],
  };
  const areas = pickNearbyAreas(answer);
  assertEquals(areas.map((a) => [a.name, a.level]), [
    ["Distrito Tec", "neighborhood"],
    ["Monterrey", "city"],
  ]);
  assertEquals(areas[0].bounds, { low: { lat: 25.64, lng: -100.3 }, high: { lat: 25.66, lng: -100.28 } });
  assertEquals(pickNearbyAreas({ status: "ZERO_RESULTS", results: [] }), []);
  assertEquals(pickNearbyAreas(null), []);
});

Deno.test("pickNearbyAreas: at most NEARBY_AREAS_MAX rows", () => {
  const results = Array.from({ length: 8 }, (_, i) => ({
    types: ["neighborhood"],
    address_components: [{ long_name: `N${i}`, types: ["neighborhood"] }],
    geometry: {
      location: { lat: 25.65, lng: -100.29 },
      viewport: { southwest: { lat: 25.64, lng: -100.3 }, northeast: { lat: 25.66, lng: -100.28 } },
    },
  }));
  assertEquals(pickNearbyAreas({ status: "OK", results }).length, NEARBY_AREAS_MAX);
});

// ── MESITA-2500: a saved location's pin ──────────────────────────────────
// Fixtures follow Google's reverse-geocode answer shape (results[0] is the
// best match for the exact point; later results are neighbours and the
// enclosing areas). Real payloads are proven by the post-deploy probes.

type Comp = { long_name: string; short_name?: string; types: string[] };
const comp = (long_name: string, types: string[], short_name = long_name): Comp => ({ long_name, short_name, types });
const MTY = comp("Monterrey", ["locality", "political"]);
const MTY_MUN = comp("Monterrey", ["administrative_area_level_2", "political"]);
const NL = comp("Nuevo León", ["administrative_area_level_1", "political"], "N.L.");
const MX = comp("México", ["country", "political"], "MX");
const colonia = (name: string) => comp(name, ["sublocality_level_1", "sublocality", "political"]);

const TEC = {
  status: "OK",
  results: [
    {
      types: ["street_address"],
      address_components: [
        comp("2501", ["street_number"]),
        comp("Avenida Eugenio Garza Sada", ["route"]),
        colonia("Tecnológico"),
        MTY, MTY_MUN, NL, MX,
      ],
    },
    {
      // The next address up the avenue, in the colonia across it: never read
      // for the street, and only after results[0] for the colonia.
      types: ["street_address"],
      address_components: [
        comp("2499", ["street_number"]),
        comp("Avenida Eugenio Garza Sada", ["route"]),
        colonia("Roma"),
        MTY, MTY_MUN, NL, MX,
      ],
    },
    { types: ["sublocality_level_1", "sublocality", "political"], address_components: [colonia("Tecnológico"), MTY, NL, MX] },
    { types: ["locality", "political"], address_components: [MTY, NL, MX] },
  ],
};

Deno.test('precision: absent is std, "pin" is pin, anything else is refused', () => {
  assertEquals(readPrecision({}), "std");
  assertEquals(readPrecision({ precision: null }), "std");
  assertEquals(readPrecision({ precision: "pin" }), "pin");
  assertEquals(readPrecision({ precision: "x" }), null);
  assertEquals(readPrecision({ precision: 4 }), null);
});

Deno.test("a pin snaps to ~11 m and asks Google for everything; std is unchanged", () => {
  assertEquals(PIN_DECIMALS, 4);
  const pin = snapPoint(25.651234, -100.289876, PIN_DECIMALS);
  assertEquals(pin, { lat: 25.6512, lng: -100.2899 });
  const pinUrl = new URL(reverseGeocodeUrl(pin, "k", "pin"));
  assertEquals(pinUrl.searchParams.get("latlng"), "25.6512,-100.2899");
  assertEquals(pinUrl.searchParams.has("result_type"), false);
  assertEquals(pinUrl.searchParams.get("language"), "es");
  const stdUrl = new URL(reverseGeocodeUrl(snapPoint(25.651234, -100.289876), "k"));
  assertEquals(stdUrl.searchParams.get("latlng"), "25.651,-100.290");
  assertEquals(stdUrl.searchParams.get("result_type"), "neighborhood|sublocality_level_1|sublocality|locality");
});

Deno.test("the cache keeps a pin and a std answer for the same point apart", () => {
  const p = { lat: 25.651, lng: -100.29 };
  assertEquals(cacheKey(p, "std"), "std:25.651,-100.290");
  assertEquals(cacheKey(p, "pin"), "pin:25.6510,-100.2900");
  assert(cacheKey(p, "std") !== cacheKey(p, "pin"));
});

Deno.test("suggested name: the colonia under the pin, read from results[0] first", () => {
  assertEquals(pickSuggestedName(TEC), "Tecnológico");
  // A neighborhood beats a sublocality in the same answer.
  assertEquals(
    pickSuggestedName({
      results: [{
        address_components: [
          comp("Colonia del Valle", ["neighborhood", "political"]),
          comp("San Pedro Garza García", ["administrative_area_level_2", "political"]),
        ],
      }],
    }),
    "Colonia del Valle",
  );
});

Deno.test('suggested name falls back: municipio, then "city, state", then null', () => {
  // A rural point with only municipio and state.
  assertEquals(
    pickSuggestedName({ results: [{ address_components: [comp("Santiago", ["administrative_area_level_2", "political"]), NL, MX] }] }),
    "Santiago",
  );
  // A locality with no municipio component.
  assertEquals(pickSuggestedName({ results: [{ address_components: [MTY, NL, MX] }] }), "Monterrey, N.L.");
  // Only a state: no honest name; the client shows "Saved location".
  assertEquals(pickSuggestedName({ results: [{ address_components: [NL, MX] }] }), null);
  assertEquals(pickSuggestedName({ status: "ZERO_RESULTS", results: [] }), null);
  assertEquals(pickSuggestedName(null), null);
});

Deno.test("suggested name skips Google's Sin Nombre placeholder at every level", () => {
  assertEquals(
    pickSuggestedName({ results: [{ address_components: [comp("Sin Nombre 34", ["neighborhood", "political"]), MTY_MUN, NL] }] }),
    "Monterrey",
  );
});

Deno.test("formatted address: route and number from the first address result only", () => {
  assertEquals(pickFormattedAddress(TEC), "Avenida Eugenio Garza Sada 2501");
  // A route with no number.
  assertEquals(
    pickFormattedAddress({ results: [{ types: ["route"], address_components: [comp("Río Orinoco", ["route"]), MTY] }] }),
    "Río Orinoco",
  );
  // No address-like result: no street line.
  assertEquals(pickFormattedAddress({ results: [{ types: ["locality"], address_components: [MTY] }] }), null);
  assertEquals(pickFormattedAddress(null), null);
});
