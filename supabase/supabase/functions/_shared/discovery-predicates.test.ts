import { assertEquals } from "jsr:@std/assert@1";
import {
  applyDeckPredicates,
  hasDeckPredicates,
  NO_DECK_PREDICATES,
  readDeckPredicates,
} from "./discovery-predicates.ts";

const OPEN_ALWAYS = {
  sunday: [{ open: "00:00", close: "23:59" }],
  monday: [{ open: "00:00", close: "23:59" }],
  tuesday: [{ open: "00:00", close: "23:59" }],
  wednesday: [{ open: "00:00", close: "23:59" }],
  thursday: [{ open: "00:00", close: "23:59" }],
  friday: [{ open: "00:00", close: "23:59" }],
  saturday: [{ open: "00:00", close: "23:59" }],
};

/** CDMX-ish coordinates so the lng-derived local clock is Central. */
function place(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "p",
    category: "mexican_restaurant",
    lat: 19.4326,
    lng: -99.1332,
    hours: OPEN_ALWAYS,
    plan: null,
    welcome_free_rate: null,
    welcome_premium_rate: null,
    free_rate: null,
    premium_rate: null,
    strike_count: 0,
    last_strike_at: null,
    promo_paused_until: null,
    plan_forfeited_at: null,
    ...over,
  };
}

Deno.test("no filters means no cut, and the same array back", () => {
  const rows = [place({ id: "a" }), place({ id: "b" })];
  const p = readDeckPredicates(undefined);
  assertEquals(hasDeckPredicates(p), false);
  assertEquals(applyDeckPredicates(rows, p, null), rows);
});

Deno.test("garbage filters degrade to no predicate rather than throwing", () => {
  for (const raw of [null, 42, "visit", [], { when: "soon" }, { maxKm: -3 }]) {
    assertEquals(readDeckPredicates(raw), NO_DECK_PREDICATES);
  }
});

Deno.test("Super Category cuts Atlas slugs; each category matches one Super", () => {
  const rows = [
    place({ id: "taco", category: "taco" }),
    place({ id: "brunch", category: "brunch" }),
    place({
      id: "shyBreakfast",
      category: "breakfast",
      family_keys: ["cafes_bakeries"],
    }),
    place({
      id: "karaoke",
      category: "karaoke",
      family_keys: ["experiences"],
    }),
  ];
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["restaurants"] }),
      null,
    ).map((r) => r.id),
    ["taco", "brunch", "shyBreakfast"],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["cafes_bakeries"] }),
      null,
    ).map((r) => r.id),
    [],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["bars_nightlife"] }),
      null,
    ).map((r) => r.id),
    ["karaoke"],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["experiences"] }),
      null,
    ).map((r) => r.id),
    [],
  );
});

Deno.test("Super undefined matches Atlas leftover category", () => {
  const rows = [
    place({ id: "unk", category: "undefined" }),
    place({ id: "taco", category: "taco" }),
  ];
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["undefined"] }),
      null,
    ).map((r) => r.id),
    ["unk"],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["restaurants"] }),
      null,
    ).map((r) => r.id),
    ["taco"],
  );
});

Deno.test("family and category are ORed across the two tiers", () => {
  const rows = [
    place({ id: "taco", category: "taco_restaurant" }),
    place({ id: "cafe", category: "coffee_shop" }),
    place({ id: "spa", category: "spa" }),
  ];
  const byFamily = applyDeckPredicates(
    rows,
    readDeckPredicates({ familyKeys: ["cafes_bakeries"] }),
    null,
  );
  assertEquals(byFamily.map((r) => r.id), ["cafe"]);

  const either = applyDeckPredicates(
    rows,
    readDeckPredicates({ familyKeys: ["cafes_bakeries"], categories: ["spa"] }),
    null,
  );
  assertEquals(either.map((r) => r.id), ["cafe", "spa"]);
});

Deno.test("distance cuts against the supplied center", () => {
  const rows = [
    place({ id: "near", lat: 19.4326, lng: -99.1332 }),
    // ~0.9 degrees of latitude ≈ 100 km north.
    place({ id: "far", lat: 20.3326, lng: -99.1332 }),
    place({ id: "nowhere", lat: null, lng: null }),
  ];
  const p = readDeckPredicates({ maxKm: 5 });
  const center = { lat: 19.4326, lng: -99.1332 };
  assertEquals(applyDeckPredicates(rows, p, center).map((r) => r.id), ["near"]);
});

Deno.test("a radius with no center keeps everything — the browser decides", () => {
  // The permissive rule that keeps this pass from ever being stricter than
  // `applyDiscoveryFilters`: cutting on a radius we cannot measure would
  // delete matches nothing downstream could restore.
  const rows = [place({ id: "a" }), place({ id: "b", lat: null, lng: null })];
  const kept = applyDeckPredicates(rows, readDeckPredicates({ maxKm: 1 }), null);
  assertEquals(kept.map((r) => r.id), ["a", "b"]);
});

Deno.test("when=at judges the requested place-local weekday and hour", () => {
  const rows = [
    place({ id: "always" }),
    place({
      id: "sat-night",
      hours: { saturday: [{ open: "20:00", close: "23:00" }] },
    }),
    place({ id: "no-hours", hours: null }),
  ];
  // Saturday (day 6) at 21:00.
  const sat = readDeckPredicates({ when: { mode: "at", day: 6, hour: 21 } });
  assertEquals(applyDeckPredicates(rows, sat, null).map((r) => r.id), [
    "always",
    "sat-night",
  ]);
  // Saturday at 10:00 — the night-only place is closed, and hours-less rows
  // stay excluded exactly as the browser excludes them.
  const morning = readDeckPredicates({ when: { mode: "at", day: 6, hour: 10 } });
  assertEquals(applyDeckPredicates(rows, morning, null).map((r) => r.id), [
    "always",
  ]);
});

Deno.test("when=now drops rows we cannot confirm are open", () => {
  const rows = [place({ id: "always" }), place({ id: "unknown", hours: {} })];
  const now = readDeckPredicates({ when: { mode: "now" } });
  assertEquals(applyDeckPredicates(rows, now, null).map((r) => r.id), ["always"]);
});

Deno.test("context: visit keeps live rewards, order narrows nothing", () => {
  const rows = [
    place({
      id: "promoting",
      plan: "pro",
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
    }),
    place({ id: "zero" }),
  ];
  assertEquals(
    applyDeckPredicates(rows, readDeckPredicates({ context: "visit" }), null).map(
      (r) => r.id,
    ),
    ["promoting"],
  );
  // `order` is parked end-to-end: it must not invent a remote catalog.
  const parked = readDeckPredicates({ context: "order" });
  assertEquals(hasDeckPredicates(parked), false);
  assertEquals(applyDeckPredicates(rows, parked, null).length, 2);
});

Deno.test("the cut is what makes a narrow filter searchable, not thinning", () => {
  // The MESITA-1153 regression in miniature: a catalog where only a handful of
  // places match, and the matches sit past the first slice of the pool.
  const catalog = [
    ...Array.from({ length: 200 }, (_, i) =>
      place({ id: `bar-${i}`, category: "bar" })),
    place({ id: "cafe-1", category: "coffee_shop" }),
    place({ id: "cafe-2", category: "cafe" }),
  ];
  const kept = applyDeckPredicates(
    catalog,
    readDeckPredicates({ familyKeys: ["cafes_bakeries"] }),
    null,
  );
  assertEquals(kept.map((r) => r.id), ["cafe-1", "cafe-2"]);
  // Slicing 50 off the UNFILTERED catalog and filtering afterwards — the old
  // order — would have found neither.
  assertEquals(
    catalog
      .slice(0, 50)
      .filter((r) => r.category === "coffee_shop" || r.category === "cafe").length,
    0,
  );
});
