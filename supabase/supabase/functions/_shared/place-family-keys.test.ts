import { assertEquals } from "jsr:@std/assert";
import {
  isEnrichedPlace,
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

// THE MEMBERSHIP COLOUR LAW (Pato, 2026-08-29): partner > enriched >
// everything else. The SERVER states `enriched`, next to `partner` and
// `promoting`, so no client re-derives it.
Deno.test("isEnrichedPlace counts ready OR a stamped enriched_at, never one alone", () => {
  assertEquals(isEnrichedPlace({ content_status: "ready" }), true);
  assertEquals(isEnrichedPlace({ enriched_at: "2026-08-01T00:00:00Z" }), true);
  // 27% of the live catalog is ready with a null enriched_at (measured
  // 2026-08-29), so an enriched_at-only test would grey a quarter of it.
  assertEquals(
    isEnrichedPlace({ content_status: "ready", enriched_at: null }),
    true,
  );
  assertEquals(isEnrichedPlace({ content_status: "queued" }), false);
  assertEquals(isEnrichedPlace({ content_status: "generating" }), false);
  assertEquals(isEnrichedPlace({}), false);
  assertEquals(isEnrichedPlace(null), false);
});

Deno.test("withFamilyKeys states enriched on the wire beside partner", () => {
  const ready = withFamilyKeys({
    id: "1",
    category: "gastropub",
    content_status: "ready",
  });
  assertEquals(ready.enriched, true);

  // A Created stub: on Mesita, nothing to show. Gray, not red.
  const stub = withFamilyKeys({ id: "2", category: "gastropub" });
  assertEquals(stub.enriched, false);
  assertEquals(stub.partner, false);

  // The guest never receives the raw enrichment verdict's inputs as the
  // answer — the boolean is always present, both ways.
  assertEquals(typeof ready.enriched, "boolean");
  assertEquals(typeof stub.enriched, "boolean");
});
