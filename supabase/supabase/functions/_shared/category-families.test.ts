import { assertEquals } from "jsr:@std/assert@1";
import { normalizeCategoryFamilies } from "./category-families.ts";

Deno.test("changing the mapping does not write families onto place profiles", async () => {
  const src = await Deno.readTextFile(
    new URL("../admin-web-set-category-families/index.ts", import.meta.url),
  );
  assertEquals(src.includes('.from("place_categories")'), true);
  assertEquals(src.includes("place_profiles"), false);
});

const ALLOWED = ["restaurants", "cafes_bakeries", "bars_nightlife", "undefined"];

Deno.test("a category can sit in more than one family", () => {
  const got = normalizeCategoryFamilies(["restaurants", "cafes_bakeries", "restaurants"], ALLOWED);
  assertEquals(got, { ok: true, keys: ["restaurants", "cafes_bakeries"] });
});

Deno.test("a category can belong to more than two families", () => {
  assertEquals(
    normalizeCategoryFamilies(
      ["restaurants", "cafes_bakeries", "bars_nightlife"],
      ALLOWED,
    ),
    { ok: true, keys: ["restaurants", "cafes_bakeries", "bars_nightlife"] },
  );
});

Deno.test("unknown slugs and undefined-plus-another are refused", () => {
  assertEquals(normalizeCategoryFamilies(["nope"], ALLOWED).ok, false);
  assertEquals(normalizeCategoryFamilies(["undefined", "restaurants"], ALLOWED).ok, false);
  assertEquals(normalizeCategoryFamilies([], ALLOWED).ok, false);
});
