import { assertEquals } from "jsr:@std/assert";
import { withFamilyKeys, withFamilyKeysList } from "./place-family-keys.ts";

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
