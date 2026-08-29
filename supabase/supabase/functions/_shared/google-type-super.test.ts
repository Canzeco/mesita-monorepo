import { assertEquals } from "jsr:@std/assert";
import {
  GOOGLE_SEARCH_TYPES,
  GOOGLE_TYPE_SUPER,
  GOOGLE_TYPES_BY_SUPER,
  autocompleteTypesForSupers,
  nearbyTypesForSupers,
  superForGoogleType,
  textSearchTypeForSuper,
  type GuestSuper,
  type SuperOrOther,
} from "./google-type-super.ts";

const GUEST: GuestSuper[] = [
  "restaurants",
  "bars_nightlife",
  "cafes_bakeries",
  "wellness_spa",
  "experiences",
  "culture_arts",
];

Deno.test("478 Google Table A types each map to exactly one Super or other", () => {
  const keys = Object.keys(GOOGLE_TYPE_SUPER);
  assertEquals(keys.length, 478);
  assertEquals(new Set(keys).size, 478);
  const counts: Record<string, number> = {};
  for (const slug of keys) {
    const superKey = GOOGLE_TYPE_SUPER[slug];
    counts[superKey!] = (counts[superKey!] ?? 0) + 1;
  }
  assertEquals(counts, {
    restaurants: 131,
    bars_nightlife: 18,
    cafes_bakeries: 22,
    wellness_spa: 27,
    experiences: 60,
    culture_arts: 19,
    other: 201,
  });
});

Deno.test("GOOGLE_TYPES_BY_SUPER is the inverse of GOOGLE_TYPE_SUPER", () => {
  const fromMap: Record<string, string[]> = {
    restaurants: [],
    bars_nightlife: [],
    cafes_bakeries: [],
    wellness_spa: [],
    experiences: [],
    culture_arts: [],
    other: [],
  };
  for (const [slug, superKey] of Object.entries(GOOGLE_TYPE_SUPER)) {
    fromMap[superKey]!.push(slug);
  }
  for (const key of Object.keys(fromMap) as SuperOrOther[]) {
    assertEquals(
      [...fromMap[key]!].sort(),
      [...GOOGLE_TYPES_BY_SUPER[key]].slice().sort(),
    );
  }
});

Deno.test("exclusive leftovers: gastropub restaurants, karaoke nightlife, casino experiences", () => {
  assertEquals(superForGoogleType("gastropub"), "restaurants");
  assertEquals(superForGoogleType("karaoke"), "bars_nightlife");
  assertEquals(superForGoogleType("casino"), "experiences");
  assertEquals(superForGoogleType("winery"), "bars_nightlife");
  assertEquals(superForGoogleType("movie_theater"), "culture_arts");
  assertEquals(superForGoogleType("hotel"), "other");
  assertEquals(superForGoogleType("gas_station"), "other");
  assertEquals(superForGoogleType("fine_dining"), "restaurants");
});

Deno.test("search batteries stay inside Google's API caps", () => {
  for (const slug of GUEST) {
    const types = GOOGLE_SEARCH_TYPES[slug];
    if (types.length < 1 || types.length > 50) {
      throw new Error(`${slug} search battery is ${types.length}`);
    }
    for (const t of types) {
      assertEquals(GOOGLE_TYPE_SUPER[t], slug);
    }
  }
  assertEquals(GOOGLE_SEARCH_TYPES.restaurants, ["restaurant"]);
  assertEquals(textSearchTypeForSuper("restaurants"), "restaurant");
  assertEquals(textSearchTypeForSuper("other"), null);
  assertEquals(
    nearbyTypesForSupers(["wellness_spa", "culture_arts"]),
    [
      ...GOOGLE_SEARCH_TYPES.wellness_spa,
      ...GOOGLE_SEARCH_TYPES.culture_arts,
    ],
  );
  assertEquals(
    autocompleteTypesForSupers(["experiences", "culture_arts"]).length <= 5,
    true,
  );
  assertEquals(nearbyTypesForSupers(["other", "nope"]), []);
});
