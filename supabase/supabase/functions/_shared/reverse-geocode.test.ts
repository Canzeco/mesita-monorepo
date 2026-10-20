import { assertEquals } from "jsr:@std/assert@1";
import {
  geocodeStatus,
  NEARBY_AREAS_MAX,
  pickAreaName,
  pickNearbyAreas,
  pointKey,
  readPoint,
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
