import { assertEquals } from "jsr:@std/assert";
import {
  DEFAULT_MAP_SUPERS,
  SUPER_PARAM_KEYS,
} from "./discovery-config.ts";
import {
  EVERY_FAMILY_TYPES,
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
  assertEquals(GOOGLE_SEARCH_TYPES.dinner[0], "restaurant");
  assertEquals(GOOGLE_SEARCH_TYPES.dinner.length, 50);
  assertEquals(GOOGLE_SEARCH_TYPES.coffee, [
    "cafe", "cat_cafe", "coffee_roastery", "coffee_shop", "coffee_stand", "dog_cafe", "juice_shop", "tea_house",
  ]);
  assertEquals("go_out" in GOOGLE_SEARCH_TYPES, false);
  assertEquals(GOOGLE_SEARCH_TYPES.undefined, []);
  assertEquals(nearbyTypesForSupers(["undefined"]), []);
  // One family: its whole battery, in order.
  assertEquals(nearbyTypesForSupers(["coffee"]), [...GOOGLE_SEARCH_TYPES.coffee]);
  // Several: round-robin, so each family's lead type comes first.
  assertEquals(nearbyTypesForSupers(["coffee", "night_out"]).slice(0, 3), ["cafe", "night_club", GOOGLE_SEARCH_TYPES.coffee[1]]);
  // Move, Feel better (MESITA-2468) and Go out (MESITA-2486) are gone: their old keys ask for nothing.
  assertEquals(nearbyTypesForSupers(["move", "feel_better", "go_out"]), []);
  assertEquals(nearbyTypesForSupers(["other", "nope"]), []);
});

Deno.test("no gym, studio, spa, salon or barber rides a battery (MESITA-2468)", () => {
  const all = new Set(Object.values(GOOGLE_SEARCH_TYPES).flat());
  for (const t of ["gym", "fitness_center", "yoga_studio", "sports_club", "swimming_pool", "spa", "massage", "barber_shop", "hair_salon", "nail_salon", "beauty_salon"]) {
    assertEquals(all.has(t), false, t);
  }
});

Deno.test("no attraction rides a battery (MESITA-2438)", () => {
  const all = new Set(Object.values(GOOGLE_SEARCH_TYPES).flat());
  for (const t of ["tourist_attraction", "museum", "park", "zoo", "bowling_alley", "movie_theater", "aquarium", "amusement_park"]) {
    assertEquals(all.has(t), false, t);
  }
});

Deno.test("every family's battery leads the every-family list, inside Google's 50", () => {
  assertEquals(EVERY_FAMILY_TYPES.length, 50);
  assertEquals(new Set(EVERY_FAMILY_TYPES).size, 50);
  const leads = Object.entries(GOOGLE_SEARCH_TYPES).filter(([k]) => k !== "undefined").map(([, v]) => v[0]);
  assertEquals(EVERY_FAMILY_TYPES.slice(0, 12), leads);
  const covered = Object.values(GOOGLE_SEARCH_TYPES).filter((types) => types.length > 0);
  assertEquals(covered.length, 12);
});

Deno.test("SUPER_PARAM_KEYS is the guest families, minus the empty battery", () => {
  const withBattery = Object.entries(GOOGLE_SEARCH_TYPES)
    .filter(([, types]) => types.length > 0)
    .map(([slug]) => slug);
  assertEquals(new Set(SUPER_PARAM_KEYS), new Set(withBattery));
  assertEquals(SUPER_PARAM_KEYS.length, 12);
  assertEquals((SUPER_PARAM_KEYS as readonly string[]).includes("undefined"), false);
});

Deno.test("the billed families default on and still lead with the old Nearby set", () => {
  const on = SUPER_PARAM_KEYS.filter((s) => DEFAULT_MAP_SUPERS[s]);
  assertEquals(
    new Set(on),
    new Set(["coffee", "dinner", "sweet", "drinks", "night_out"]),
  );
  const leads = on.map((s) => GOOGLE_SEARCH_TYPES[s][0]);
  assertEquals(
    new Set(leads),
    new Set(["restaurant", "bar", "night_club", "cafe", "bakery"]),
  );
});
