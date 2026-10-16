import { assertEquals } from "jsr:@std/assert";
import {
  DEFAULT_MAP_SUPERS,
  SUPER_PARAM_KEYS,
  NEARBY_TYPE_KEYS,
} from "./discovery-config.ts";
import {
  GOOGLE_SEARCH_TYPES,
  GOOGLE_TYPE_SUPER,
  nearbyTypesForSupers,
  superForGoogleType,
} from "./google-type-super.ts";

Deno.test("478 Google Table A types each map to exactly one of the eight families", () => {
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
    undefined: 201,
  });
});

Deno.test("Google side stays exclusive even where the category is a double", () => {
  assertEquals(superForGoogleType("gastropub"), "restaurants");
  assertEquals(superForGoogleType("karaoke"), "bars_nightlife");
  assertEquals(superForGoogleType("casino"), "experiences");
  assertEquals(superForGoogleType("winery"), "bars_nightlife");
  assertEquals(superForGoogleType("movie_theater"), "experiences");
  assertEquals(superForGoogleType("breakfast_restaurant"), "restaurants");
  assertEquals(superForGoogleType("hotel"), "undefined");
  assertEquals(superForGoogleType("gas_station"), "undefined");
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
  for (const slug of Object.keys(GOOGLE_SEARCH_TYPES)) {
    const types = GOOGLE_SEARCH_TYPES[slug as keyof typeof GOOGLE_SEARCH_TYPES];
    if (slug === "undefined") {
      assertEquals(types.length, 0);
      continue;
    }
    if (types.length < 1 || types.length > 50) {
      throw new Error(`${slug} search battery is ${types.length}`);
    }
    for (const t of types) {
      if (!GOOGLE_TYPE_SUPER[t]) throw new Error(`${t} is not a Table A type`);
    }
  }
  assertEquals(GOOGLE_SEARCH_TYPES.dinner, ["restaurant"]);
  assertEquals(GOOGLE_SEARCH_TYPES.undefined, []);
  assertEquals(nearbyTypesForSupers(["undefined"]), []);
  assertEquals(
    nearbyTypesForSupers(["move", "go_out"]),
    [
      ...GOOGLE_SEARCH_TYPES.move,
      ...GOOGLE_SEARCH_TYPES.go_out,
    ],
  );
  assertEquals(nearbyTypesForSupers(["other", "nope"]), []);
});

Deno.test("NEARBY_TYPE_KEYS is exactly GOOGLE_SEARCH_TYPES, flattened", () => {
  const flat = Object.values(GOOGLE_SEARCH_TYPES).flatMap((types) => [...types]);
  assertEquals([...NEARBY_TYPE_KEYS], flat);
  const covered = Object.values(GOOGLE_SEARCH_TYPES).filter((types) => types.length > 0);
  assertEquals(covered.length, 15);
});

Deno.test("SUPER_PARAM_KEYS is the guest families, minus the empty battery", () => {
  const withBattery = Object.entries(GOOGLE_SEARCH_TYPES)
    .filter(([, types]) => types.length > 0)
    .map(([slug]) => slug);
  assertEquals(new Set(SUPER_PARAM_KEYS), new Set(withBattery));
  assertEquals(SUPER_PARAM_KEYS.length, 15);
  assertEquals((SUPER_PARAM_KEYS as readonly string[]).includes("undefined"), false);
});

Deno.test("the billed families default on and still send the old Nearby set", () => {
  const on = SUPER_PARAM_KEYS.filter((s) => DEFAULT_MAP_SUPERS[s]);
  assertEquals(
    new Set(on),
    new Set(["coffee", "dinner", "sweet", "drinks", "night_out"]),
  );
  const flat = on.flatMap((s) => [...GOOGLE_SEARCH_TYPES[s]]);
  assertEquals(
    new Set(flat),
    new Set(["restaurant", "bar", "night_club", "cafe", "bakery"]),
  );
});
