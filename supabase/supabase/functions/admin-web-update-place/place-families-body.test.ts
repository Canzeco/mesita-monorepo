// MESITA-2893: what the admin door does with an operator's family list. The
// failure that matters is data loss — a list refused for the wrong reason, a
// sixth family silently dropped, or an emptied list read as an edit.

import { assertEquals } from "jsr:@std/assert@1";
import { readFamilyKeysBody } from "./place-families-body.ts";
import { FAMILIES_MAX } from "../_shared/families-infer.ts";

const FAMILIES = [
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
  { slug: "breakfast", label: "Breakfast", emoji: "🍳", sort_order: 2 },
  { slug: "quick_bite", label: "Quick", emoji: "⚡", sort_order: 6 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 7 },
  { slug: "mexican", label: "Mexican", emoji: "🌶️", sort_order: 12 },
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 23 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 26 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 999 },
];

Deno.test("a picked list is stored in catalog order, deduplicated", () => {
  const r = readFamilyKeysBody([" mexican", "tacos", "quick_bite", "tacos"], FAMILIES);
  assertEquals(r, { ok: true, keys: ["quick_bite", "tacos", "mexican"] });
});

Deno.test("null, [] and a list of blanks clear the families", () => {
  assertEquals(readFamilyKeysBody(null, FAMILIES), { ok: true, keys: null });
  assertEquals(readFamilyKeysBody([], FAMILIES), { ok: true, keys: null });
  assertEquals(readFamilyKeysBody(["", "  "], FAMILIES), { ok: true, keys: null });
});

Deno.test("a sixth family is refused, never trimmed", () => {
  const six = ["coffee", "breakfast", "quick_bite", "tacos", "mexican", "dinner"];
  assertEquals(six.length, FAMILIES_MAX + 1);
  const r = readFamilyKeysBody(six, FAMILIES);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.body.code, "too_many_families");
});

Deno.test("an unknown slug, and Undefined, are named in the 400", () => {
  const r = readFamilyKeysBody(["tacos", "sushi", "undefined"], FAMILIES);
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.body.code, "unknown_family");
    assertEquals(r.body.slugs, ["sushi", "undefined"]);
    assertEquals(r.body.fix, "Reload the page to refresh the list.");
  }
});

Deno.test("a non-list body is refused", () => {
  const r = readFamilyKeysBody("tacos", FAMILIES);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.body.code, "invalid_family_keys");
});

Deno.test("the cap is the one number the trigger and the editor share", () => {
  assertEquals(FAMILIES_MAX, 5);
});
