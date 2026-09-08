import { assertEquals } from "jsr:@std/assert";
import {
  DEFAULT_MAP_TYPES,
  NEARBY_TYPE_KEYS,
  type NearbyTypeKey,
} from "./discovery-config.ts";
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
  "sports_fitness",
  "wellness_beauty",
  "experiences",
  "culture_arts",
  "undefined",
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
    sports_fitness: 14,
    wellness_beauty: 16,
    experiences: 58,
    culture_arts: 18,
    other: 201,
  });
});

Deno.test("GOOGLE_TYPES_BY_SUPER is the inverse of GOOGLE_TYPE_SUPER", () => {
  const fromMap: Record<string, string[]> = {
    restaurants: [],
    bars_nightlife: [],
    cafes_bakeries: [],
    sports_fitness: [],
    wellness_beauty: [],
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

Deno.test("Google side stays exclusive even where the category is a double", () => {
  assertEquals(superForGoogleType("gastropub"), "restaurants");
  assertEquals(superForGoogleType("karaoke"), "bars_nightlife");
  assertEquals(superForGoogleType("casino"), "experiences");
  assertEquals(superForGoogleType("winery"), "bars_nightlife");
  assertEquals(superForGoogleType("movie_theater"), "experiences");
  assertEquals(superForGoogleType("breakfast_restaurant"), "restaurants");
  assertEquals(superForGoogleType("hotel"), "other");
  assertEquals(superForGoogleType("gas_station"), "other");
  assertEquals(superForGoogleType("fine_dining"), "restaurants");
});

Deno.test("sports split from beauty on the Google side too", () => {
  assertEquals(superForGoogleType("gym"), "sports_fitness");
  assertEquals(superForGoogleType("swimming_pool"), "sports_fitness");
  assertEquals(superForGoogleType("tennis_court"), "sports_fitness");
  assertEquals(superForGoogleType("sports_complex"), "sports_fitness");
  assertEquals(superForGoogleType("yoga_studio"), "sports_fitness");
  assertEquals(superForGoogleType("spa"), "wellness_beauty");
  assertEquals(superForGoogleType("barber_shop"), "wellness_beauty");
  assertEquals(superForGoogleType("nail_salon"), "wellness_beauty");
  assertEquals(superForGoogleType("tanning_studio"), "wellness_beauty");
  assertEquals(superForGoogleType("stadium"), "experiences");
});

Deno.test("search batteries stay inside Google's API caps", () => {
  for (const slug of GUEST) {
    const types = GOOGLE_SEARCH_TYPES[slug];
    if (slug === "undefined") {
      assertEquals(types.length, 0);
      continue;
    }
    if (types.length < 1 || types.length > 50) {
      throw new Error(`${slug} search battery is ${types.length}`);
    }
    for (const t of types) {
      assertEquals(GOOGLE_TYPE_SUPER[t], slug);
    }
  }
  assertEquals(GOOGLE_SEARCH_TYPES.restaurants, ["restaurant"]);
  assertEquals(GOOGLE_SEARCH_TYPES.undefined, []);
  assertEquals(textSearchTypeForSuper("restaurants"), "restaurant");
  assertEquals(textSearchTypeForSuper("undefined"), null);
  assertEquals(textSearchTypeForSuper("other"), null);
  assertEquals(nearbyTypesForSupers(["undefined"]), []);
  assertEquals(
    nearbyTypesForSupers(["sports_fitness", "culture_arts"]),
    [
      ...GOOGLE_SEARCH_TYPES.sports_fitness,
      ...GOOGLE_SEARCH_TYPES.culture_arts,
    ],
  );
  assertEquals(
    autocompleteTypesForSupers(["experiences", "culture_arts"]).length <= 5,
    true,
  );
  assertEquals(nearbyTypesForSupers(["other", "nope"]), []);
});

// MESITA-1683: the strip drifted to five keys covering three Super Categories
// while the law had seven and 22 types, and nothing caught it. This is the
// fix — the list is pinned to the taxonomy, so adding a Super or a battery
// entry without touching NEARBY_TYPE_KEYS fails here instead of quietly
// hiding a whole category from the operator for weeks.
Deno.test("NEARBY_TYPE_KEYS is exactly GOOGLE_SEARCH_TYPES, flattened", () => {
  const flat = (Object.keys(GOOGLE_SEARCH_TYPES) as GuestSuper[])
    .flatMap((s) => [...GOOGLE_SEARCH_TYPES[s]]);
  assertEquals([...NEARBY_TYPE_KEYS], flat);
  // Every guest Super is represented; `undefined` is the one empty battery.
  const covered = new Set(
    (Object.keys(GOOGLE_SEARCH_TYPES) as GuestSuper[]).filter(
      (s) => GOOGLE_SEARCH_TYPES[s].length > 0,
    ),
  );
  assertEquals(covered.size, 7);
});

// The cap keeps the FIRST n entries, so the five the strip billed before this
// grew must stay inside the first five or an operator's stored count silently
// changes which Google calls happen.
Deno.test("the original five stay within the first five, whatever the order", () => {
  const before: NearbyTypeKey[] = ["restaurant", "bar", "cafe", "night_club", "bakery"];
  assertEquals(
    new Set(NEARBY_TYPE_KEYS.slice(0, 5)),
    new Set(before),
  );
  for (const k of before) assertEquals(DEFAULT_MAP_TYPES[k], true);
  for (const k of NEARBY_TYPE_KEYS.slice(5)) {
    assertEquals(DEFAULT_MAP_TYPES[k], false);
  }
});
