import { assertEquals } from "jsr:@std/assert@1";
import {
  geocodeStatus,
  pickAreaName,
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
