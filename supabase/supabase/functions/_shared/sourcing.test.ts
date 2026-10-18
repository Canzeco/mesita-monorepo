import { assertEquals } from "jsr:@std/assert";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesCallerRegion,
  applyPlacesTextSearchRegion,
  familiesForGoogleType,
  parseCldrRegionCode,
} from "./sourcing.ts";

Deno.test("familiesForGoogleType: a gastropub is dinner and drinks", () => {
  assertEquals(familiesForGoogleType("gastropub"), ["dinner", "drinks"]);
  assertEquals(familiesForGoogleType("gas_station"), []);
});

Deno.test("familiesForGoogleType: a place that is not a trip sits in no family (MESITA-2382)", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261018200000_atlas_loose_types_no_family.sql", import.meta.url),
  );
  const slugs = [...sql.matchAll(/^\s+'([a-z_]+)',?$/gm)].map((m) => m[1]);
  assertEquals(slugs.length, 23);
  for (const slug of [...slugs, "car_repair", "church", "hotel"]) {
    assertEquals(familiesForGoogleType(slug), [], slug);
  }
});

Deno.test("familiesForGoogleType accepts the _restaurant alias", () => {
  assertEquals(familiesForGoogleType("fine_dining"), ["dinner"]);
  assertEquals(familiesForGoogleType("FINE_DINING"), ["dinner"]);
});

Deno.test("Text Search without a pin sends no country or bias", () => {
  const body: Record<string, unknown> = { textQuery: "tacos" };
  applyPlacesTextSearchRegion(body);
  assertEquals(body.regionCode, undefined);
  assertEquals("locationBias" in body, false);
});

Deno.test("Autocomplete caller code is applied; no pin means no bias", () => {
  const body: Record<string, unknown> = { input: "taco" };
  applyPlacesAutocompleteRegion(body);
  assertEquals(body.regionCode, undefined);
  assertEquals(body.includedRegionCodes, undefined);
  assertEquals("locationBias" in body, false);
  applyPlacesCallerRegion(body, "MX", "autocomplete");
  assertEquals(body.regionCode, "MX");
  assertEquals(body.includedRegionCodes, ["MX"]);
});

Deno.test("guest pin biases Text Search without a country", () => {
  const body: Record<string, unknown> = { textQuery: "mezcal" };
  applyPlacesTextSearchRegion(body, { lat: 19.43, lng: -99.13 });
  assertEquals(body.regionCode, undefined);
  assertEquals("locationRestriction" in body, false);
  const bias = body.locationBias as { circle?: unknown };
  assertEquals(Boolean(bias?.circle), true);
});

Deno.test("parseCldrRegionCode drops junk and accepts two letters", () => {
  assertEquals(parseCldrRegionCode(""), "");
  assertEquals(parseCldrRegionCode("mx"), "MX");
  assertEquals(parseCldrRegionCode("MEX"), "");
  assertEquals(parseCldrRegionCode("12"), "");
});
