import { assertEquals } from "jsr:@std/assert";
import { withFamilyKeys, withFamilyKeysList } from "./place-family-keys.ts";

Deno.test("withFamilyKeys attaches dual-family keys for gastropub", () => {
  const out = withFamilyKeys({ id: "1", category: "gastropub" });
  assertEquals(out.family_keys, ["restaurants", "bars_nightlife"]);
  assertEquals(out.id, "1");
});

Deno.test("withFamilyKeys accepts _restaurant alias for truncated slugs", () => {
  const out = withFamilyKeys({ category: "fine_dining" });
  assertEquals(out.family_keys, ["restaurants"]);
});

Deno.test("withFamilyKeys returns [] for unknown / empty category", () => {
  assertEquals(withFamilyKeys({ category: "gas_station" }).family_keys, []);
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
