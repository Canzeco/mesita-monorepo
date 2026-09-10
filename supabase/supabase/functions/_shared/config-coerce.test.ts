import { assertEquals } from "jsr:@std/assert";
import { asRecord, bool, num } from "./config-coerce.ts";

// These three were written out five times across the config normalizers before
// they were shared. The tests pin the behaviours the copies agreed on — the
// ones a "tidier" rewrite would quietly change.

Deno.test("num: a finite number inside the range passes through", () => {
  assertEquals(num(42, 0, 0, 100), 42);
  assertEquals(num(0, 9, 0, 100), 0); // 0 is a value, not absence
});

Deno.test("num: out of range CLAMPS, it does not fall back", () => {
  // The distinction that matters: a saved 500 on a knob that caps at 100 means
  // "as high as it goes". Dropping to the fallback would undo an operator edit.
  assertEquals(num(500, 7, 0, 100), 100);
  assertEquals(num(-500, 7, 0, 100), 0);
});

Deno.test("num: numeric strings are accepted — a console input may arrive either way", () => {
  assertEquals(num("42", 0, 0, 100), 42);
  assertEquals(num("42.5", 0, 0, 100), 42.5);
});

Deno.test("num: what Number() cannot read takes the fallback", () => {
  for (const raw of [undefined, "abc", {}, NaN, Infinity, -Infinity]) {
    assertEquals(num(raw, 7, 0, 100), 7, `raw=${JSON.stringify(raw)}`);
  }
});

Deno.test("num: null / \"\" / [] read as 0, NOT as the fallback", () => {
  // Inherited behaviour, pinned deliberately rather than fixed: `Number()` is
  // what decides "is this a number", and Number(null) === Number("") ===
  // Number([]) === 0. So a key stored as a literal JSON null reads 0 and then
  // clamps to `min`. Only `undefined` — a key the blob does not carry — takes
  // the fallback, which is the path a normalizer indexing a missing key hits.
  assertEquals(num(null, 7, 0, 100), 0);
  assertEquals(num("", 7, 0, 100), 0);
  assertEquals(num(" ", 7, 0, 100), 0);
  assertEquals(num([], 7, 0, 100), 0);
  // …and the clamp still applies, so a floor above zero wins over that 0.
  assertEquals(num(null, 7, 5, 100), 5);
});

Deno.test("num: the fallback is returned as given, never clamped", () => {
  // A default outside its own range is a bug in the caller's DEFAULTS, and the
  // coercer must not hide it by silently snapping the value.
  assertEquals(num("nonsense", 999, 0, 100), 999);
});

Deno.test("bool: only a real boolean wins", () => {
  assertEquals(bool(true, false), true);
  assertEquals(bool(false, true), false);
});

Deno.test("bool: truthy/falsy look-alikes take the fallback, not their coercion", () => {
  // Strict on purpose: "a knob that is missing" and "a knob turned off" are
  // different facts, and a section gaining a key must not read every older row
  // as off.
  for (const raw of [undefined, null, 0, 1, "", "false", "true", {}, []]) {
    assertEquals(bool(raw, true), true, `raw=${JSON.stringify(raw)}`);
    assertEquals(bool(raw, false), false, `raw=${JSON.stringify(raw)}`);
  }
});

Deno.test("asRecord: a plain object is handed back unchanged", () => {
  const blob = { a: 1 };
  assertEquals(asRecord(blob), blob);
});

Deno.test("asRecord: an array is NOT a record", () => {
  // An array would index cleanly and read every key as undefined, so a
  // malformed section would save as a full set of defaults and look fine.
  assertEquals(asRecord([1, 2]), {});
  assertEquals(asRecord([]), {});
});

Deno.test("asRecord: null, undefined and scalars collapse to an empty record", () => {
  for (const raw of [null, undefined, 0, "", "x", true]) {
    assertEquals(asRecord(raw), {}, `raw=${JSON.stringify(raw)}`);
  }
});
