import { assertEquals } from "jsr:@std/assert";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesCallerRegion,
  applyPlacesTextSearchRegion,
  familiesForGoogleType,
  familyForGoogleType,
  parseCldrRegionCode,
} from "./sourcing.ts";

Deno.test("familyForGoogleType maps known types", () => {
  assertEquals(familyForGoogleType("mexican_restaurant"), "restaurants");
  assertEquals(familyForGoogleType("night_club"), "bars_nightlife");
  assertEquals(familyForGoogleType("gas_station"), null);
});

Deno.test("familiesForGoogleType returns restaurants only for gastropub", () => {
  assertEquals(familiesForGoogleType("gastropub"), ["restaurants"]);
});

Deno.test("familiesForGoogleType accepts _restaurant alias", () => {
  assertEquals(familiesForGoogleType("fine_dining"), ["restaurants"]);
  assertEquals(familiesForGoogleType("FINE_DINING"), ["restaurants"]);
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
