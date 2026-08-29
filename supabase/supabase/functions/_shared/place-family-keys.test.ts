import { assertEquals } from "jsr:@std/assert";
import { withFamilyKeys, withFamilyKeysList } from "./place-family-keys.ts";

Deno.test("withFamilyKeys attaches dual-family keys for gastropub", () => {
  const out = withFamilyKeys({ id: "1", category: "gastropub" });
  assertEquals(out.family_keys, ["restaurants", "bars_nightlife"]);
  assertEquals(out.id, "1");
});

Deno.test("withFamilyKeys maps Atlas slugs, including intersections", () => {
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
});

Deno.test("withFamilyKeys prefers stored Super Categories", () => {
  const out = withFamilyKeys({
    category: "mexican",
    family_keys: ["bars_nightlife"],
  });
  assertEquals(out.family_keys, ["bars_nightlife"]);
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
