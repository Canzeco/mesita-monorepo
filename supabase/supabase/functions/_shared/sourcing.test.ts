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
  // MESITA-2888 made rails of seven: a cafeteria is Quick, a picnic ground
  // Family, and a plaza, fountain, sculpture, marina or race course is
  // Tourist or Fun. The other sixteen stay out.
  const rails: Record<string, string[]> = {
    cafeteria: ["quick_bite"],
    picnic_ground: ["family"],
    plaza: ["tourist"],
    fountain: ["tourist"],
    sculpture: ["tourist"],
    marina: ["tourist"],
    race_course: ["fun"],
  };
  for (const slug of [...slugs.filter((s) => !(s in rails)), "car_repair", "church", "hotel"]) {
    assertEquals(familiesForGoogleType(slug), [], slug);
  }
  for (const [slug, families] of Object.entries(rails)) {
    assertEquals(familiesForGoogleType(slug), families, slug);
  }
});

Deno.test("familiesForGoogleType accepts the _restaurant alias", () => {
  assertEquals(familiesForGoogleType("fine_dining"), ["dinner", "fancy"]);
  assertEquals(familiesForGoogleType("FINE_DINING"), ["dinner", "fancy"]);
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
