import { assertEquals } from "jsr:@std/assert@1";
import { normalizeCategoryFamilies } from "./category-families.ts";

const ALLOWED = ["restaurants", "cafes_bakeries", "undefined"];

Deno.test("a category can sit in more than one family", () => {
  const got = normalizeCategoryFamilies(["restaurants", "cafes_bakeries", "restaurants"], ALLOWED);
  assertEquals(got, { ok: true, keys: ["restaurants", "cafes_bakeries"] });
});

Deno.test("unknown slugs and undefined-plus-another are refused", () => {
  assertEquals(normalizeCategoryFamilies(["nope"], ALLOWED).ok, false);
  assertEquals(normalizeCategoryFamilies(["undefined", "restaurants"], ALLOWED).ok, false);
});
