import { assertEquals } from "jsr:@std/assert";
import { withFamilyKeys, withFamilyKeysList } from "./place-family-keys.ts";

Deno.test("withFamilyKeys attaches one Super for gastropub", () => {
  const out = withFamilyKeys({ id: "1", category: "gastropub" });
  assertEquals(out.family_keys, ["restaurants"]);
  assertEquals(out.id, "1");
});

Deno.test("withFamilyKeys maps Atlas slugs exclusively", () => {
  assertEquals(withFamilyKeys({ category: "mexican" }).family_keys, [
    "restaurants",
  ]);
  assertEquals(withFamilyKeys({ category: "fine_dining" }).family_keys, [
    "restaurants",
  ]);
  assertEquals(withFamilyKeys({ category: "breakfast" }).family_keys, [
    "restaurants",
  ]);
});

Deno.test("withFamilyKeys keeps the Atlas Super when stored keys disagree", () => {
  assertEquals(
    withFamilyKeys({
      category: "breakfast",
      family_keys: ["cafes_bakeries"],
    }).family_keys,
    ["restaurants"],
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
    ["bars_nightlife"],
  );
});

Deno.test("withFamilyKeys returns [] for unknown / empty / undefined category", () => {
  assertEquals(withFamilyKeys({ category: "gas_station" }).family_keys, []);
  assertEquals(withFamilyKeys({ category: "undefined" }).family_keys, []);
  assertEquals(withFamilyKeys({ category: null }).family_keys, []);
  assertEquals(withFamilyKeys({}).family_keys, []);
});

Deno.test("withFamilyKeysList maps a list", () => {
  const rows = withFamilyKeysList([
    { category: "cafe" },
    { category: "museum" },
  ]);
  assertEquals(rows[0]?.family_keys, ["cafes_bakeries"]);
  assertEquals(rows[1]?.family_keys, ["culture_arts"]);
});
