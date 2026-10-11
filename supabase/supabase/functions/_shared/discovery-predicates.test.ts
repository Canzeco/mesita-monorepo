import { assertEquals } from "jsr:@std/assert@1";
import {
  applyDeckPredicates,
  hasDeckPredicates,
  NO_DECK_PREDICATES,
  readDeckPredicates,
} from "./discovery-predicates.ts";

function place(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "p",
    category: "mexican_restaurant",
    ...over,
  };
}

Deno.test("no filters means no cut, and the same array back", () => {
  const rows = [place({ id: "a" }), place({ id: "b" })];
  const p = readDeckPredicates(undefined);
  assertEquals(hasDeckPredicates(p), false);
  assertEquals(applyDeckPredicates(rows, p), rows);
});

Deno.test("garbage filters degrade to no predicate rather than throwing", () => {
  for (
    const raw of [
      null,
      42,
      "visit",
      [],
      { familyKeys: "restaurants" },
      { familyKeys: [42, "  "] },
      { minReviews: -3 },
      { minReviews: "lots" },
    ]
  ) {
    assertEquals(readDeckPredicates(raw), NO_DECK_PREDICATES);
  }
});

Deno.test("Family cuts Atlas slugs; a double-parent category matches both pills", () => {
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
    ).map((r) => r.id),
    ["taco", "brunch", "shyBreakfast"],
  );
  // brunch and breakfast are restaurants AND cafés — the cafés pill
  // matches them too (full membership, stored subsets ignored).
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["cafes_bakeries"] }),
    ).map((r) => r.id),
    ["brunch", "shyBreakfast"],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["bars_nightlife"] }),
    ).map((r) => r.id),
    ["karaoke"],
  );
  // karaoke is bars AND experiences.
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["experiences"] }),
    ).map((r) => r.id),
    ["karaoke"],
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
    ).map((r) => r.id),
    ["unk"],
  );
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ familyKeys: ["restaurants"] }),
    ).map((r) => r.id),
    ["taco"],
  );
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

Deno.test("Places scope cuts nothing server-side — every pooled row is Mesita's", () => {
  // A Mesita row sits in both rings, so no scope can drop one here; the
  // browser, which also holds Google stubs, is where the scope narrows.
  const rows = [place({ id: "a" }), place({ id: "b" })];
  for (const placesScope of ["mesita", "google", "partners"]) {
    const p = readDeckPredicates({ placesScope });
    assertEquals(hasDeckPredicates(p), false, placesScope);
    assertEquals(applyDeckPredicates(rows, p), rows, placesScope);
  }
});

Deno.test("Google review floor drops places below the stop and places with no count", () => {
  const rows = [
    place({ id: "hot", google_review_count: 400 }),
    place({ id: "quiet", google_review_count: 8 }),
    place({ id: "unknown" }),
  ];
  assertEquals(
    applyDeckPredicates(
      rows,
      readDeckPredicates({ minReviews: 100 }),
    ).map((r) => r.id),
    ["hot"],
  );
});
