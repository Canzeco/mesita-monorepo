import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  isDuplicateRfcError,
  isShapedRfc,
  MEXICO_RFC_RE,
  normalizeRfc,
  readRfc,
} from "./place-rfc.ts";
import { MEXICO_RFC_RE as PREFILL_RE, rfcIfValid } from "./stripe-connect-prefill.ts";

Deno.test("normalizeRfc trims, upper-cases, and calls nothing an RFC", () => {
  assertEquals(normalizeRfc("  mesita010101abc "), "MESITA010101ABC");
  assertEquals(normalizeRfc("XAXX010101000"), "XAXX010101000");
  // "No RFC" is a legal state — an org can hold places before it is paid.
  assertEquals(normalizeRfc(null), null);
  assertEquals(normalizeRfc(undefined), null);
  assertEquals(normalizeRfc(""), null);
  assertEquals(normalizeRfc("   "), null);
  assertEquals(normalizeRfc(12345), null);
});

Deno.test("isShapedRfc accepts persona moral (12) and física (13)", () => {
  assert(isShapedRfc("ABC010101XY1"), "12-char persona moral");
  assert(isShapedRfc("XAXX010101000"), "13-char persona física");
  assert(isShapedRfc("AÑ&010101XY1"), "Ñ and & are legal in the name block");
});

Deno.test("isShapedRfc refuses what the old length cap let through", () => {
  // Every one of these is <= 20 chars, so business-web-update-place's
  // previous check passed them — and prefill then silently dropped them.
  assertFalse(isShapedRfc("not-an-rfc"));
  assertFalse(isShapedRfc("ABC010101"), "too short");
  assertFalse(isShapedRfc("ABCD010101XY12"), "too long");
  assertFalse(isShapedRfc("1BC010101XY1"), "digit in the name block");
  assertFalse(isShapedRfc("ABC0101O1XY1"), "letter in the date block");
});

Deno.test("readRfc is the two writers' shared door", () => {
  assertEquals(readRfc(" xaxx010101000 "), { ok: true, rfc: "XAXX010101000" });
  assertEquals(readRfc(null), { ok: true, rfc: null });
  assertEquals(readRfc(""), { ok: true, rfc: null });
  assertEquals(readRfc("nope"), { ok: false });
});

// THE TWIN. The regex is stated twice — here in TypeScript and in SQL as
// `places_rfc_shape`. If one moves without the other, a value the EF
// accepts gets rejected by the database as a 500, or a value the database
// accepts never reaches Stripe. This test pins the TS side to the literal the
// migration carries; changing either means changing both.
Deno.test("MEXICO_RFC_RE matches the places_rfc_shape CHECK", () => {
  assertEquals(MEXICO_RFC_RE.source, "^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$");
});

Deno.test("prefill re-exports the same rule, not a copy", () => {
  assertEquals(PREFILL_RE, MEXICO_RFC_RE);
  // rfcIfValid keeps its fail-open contract for rows written before the CHECK.
  assertEquals(rfcIfValid("xaxx010101000"), "XAXX010101000");
  assertEquals(rfcIfValid("not-an-rfc"), null);
  assertEquals(rfcIfValid(null), null);
});

Deno.test("isDuplicateRfcError fires only on the RFC index", () => {
  assert(
    isDuplicateRfcError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "places_rfc_unique"',
      details: null,
    }),
  );
  // A different unique index on the same table must NOT read as "RFC taken".
  assertFalse(
    isDuplicateRfcError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "places_pkey"',
      details: null,
    }),
  );
  assertFalse(isDuplicateRfcError({ code: "23503", message: "fk", details: null }));
  assertFalse(isDuplicateRfcError(null));
});
