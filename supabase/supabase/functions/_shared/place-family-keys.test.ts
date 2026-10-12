import { assertEquals } from "jsr:@std/assert";
import {
  isEnrichedPlace,
  type PlaceCategoryRow,
  withFamilyKeys,
  withFamilyKeysList,
} from "./place-family-keys.ts";

Deno.test("withFamilyKeys attaches one Super for gastropub", () => {
  const out = withFamilyKeys({ id: "1", category: "gastropub" });
  assertEquals(out.family_keys, ["restaurants"]);
  assertEquals(out.id, "1");
});

Deno.test("withFamilyKeys ships the FULL Atlas membership (1–2 supers)", () => {
  assertEquals(withFamilyKeys({ category: "mexican" }).family_keys, [
    "restaurants",
  ]);
  assertEquals(withFamilyKeys({ category: "fine_dining" }).family_keys, [
    "restaurants",
  ]);
  assertEquals(withFamilyKeys({ category: "breakfast" }).family_keys, [
    "restaurants",
    "cafes_bakeries",
  ]);
  assertEquals(withFamilyKeys({ category: "karaoke" }).family_keys, [
    "bars_nightlife",
    "experiences",
  ]);
});

Deno.test("withFamilyKeys keeps the Atlas membership when stored keys disagree", () => {
  assertEquals(
    withFamilyKeys({
      category: "breakfast",
      family_keys: ["cafes_bakeries"],
    }).family_keys,
    ["restaurants", "cafes_bakeries"],
  );
  assertEquals(
    withFamilyKeys({
      category: "mexican",
      family_keys: ["bars_nightlife"],
    }).family_keys,
    ["restaurants"],
  );
  assertEquals(
    withFamilyKeys({
      category: "undefined",
      family_keys: ["bars_nightlife"],
    }).family_keys,
    ["undefined"],
  );
});

Deno.test("withFamilyKeys is TOTAL: undefined category and leftovers land on Other", () => {
  assertEquals(withFamilyKeys({ category: "undefined" }).family_keys, [
    "undefined",
  ]);
  assertEquals(withFamilyKeys({ category: "gas_station" }).family_keys, [
    "undefined",
  ]);
  assertEquals(withFamilyKeys({ category: null }).family_keys, ["undefined"]);
  assertEquals(withFamilyKeys({}).family_keys, ["undefined"]);
});

Deno.test("withFamilyKeysList maps a list", () => {
  const rows = withFamilyKeysList([
    { category: "cafe" },
    { category: "museum" },
  ]);
  assertEquals(rows[0]?.family_keys, ["cafes_bakeries"]);
  assertEquals(rows[1]?.family_keys, ["culture_arts"]);
});

// THE MEMBERSHIP COLOUR LAW (Pato, 2026-08-29): enriched > everything else.
// The SERVER states `enriched`, so no client re-derives it.
// MESITA-2154: enriched = an Enrich run completed = `enriched_at` set.
Deno.test("isEnrichedPlace: enriched_at set, and nothing else", () => {
  const rows: Record<string, PlaceCategoryRow> = {
    stamped: { enriched_at: "2026-08-01T00:00:00Z" },
    reEnriching: { content_state: "generating", enriched_at: "2026-08-01T00:00:00Z" },
    // A Created place: Create saves ready and never stamps enriched_at.
    readyOnly: { content_state: "ready" },
    created: { content_state: "ready", enriched_at: null },
    generating: { content_state: "generating" },
    failed: { content_state: "failed" },
    blank: { enriched_at: "  " },
    empty: {},
  };
  assertEquals(isEnrichedPlace(rows.stamped), true);
  assertEquals(
    isEnrichedPlace(rows.reEnriching),
    true,
    "a re-enrich in flight keeps an enriched place enriched",
  );
  for (const key of ["readyOnly", "created", "generating", "failed", "blank", "empty"]) {
    assertEquals(isEnrichedPlace(rows[key]), false, key);
  }
  assertEquals(isEnrichedPlace(null), false);
});

Deno.test("withFamilyKeys states enriched on the wire", () => {
  const enriched = withFamilyKeys({
    id: "1",
    category: "gastropub",
    content_state: "ready",
    enriched_at: "2026-08-01T00:00:00Z",
  });
  assertEquals(enriched.enriched, true);

  // A Created place: viewable (ready), NOT enriched. Gray, not red.
  const created = withFamilyKeys({
    id: "2",
    category: "gastropub",
    content_state: "ready",
    enriched_at: null,
  });
  assertEquals(created.enriched, false);

  // The guest never receives the raw enrichment verdict's inputs as the
  // answer — the boolean is always present, both ways.
  assertEquals(typeof enriched.enriched, "boolean");
  assertEquals(typeof created.enriched, "boolean");
});
