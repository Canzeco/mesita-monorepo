import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { hashPlaceCode, hashVisitCode, isBillCents, newVisitCode, readPlaceCode, readSince, readVisitCode } from "./place-visits.ts";

Deno.test("since is a real moment or nothing", () => {
  assertEquals(readSince("2026-11-04T09:00:00.000Z"), "2026-11-04T09:00:00.000Z");
  assertEquals(readSince("not a date"), null);
  assertEquals(readSince(1793782729), null);
});

Deno.test("a code hash is bound to its place", async () => {
  const a = await hashVisitCode("place-a", "123456");
  assertEquals(a, await hashVisitCode("place-a", "123456"));
  assertNotEquals(a, await hashVisitCode("place-b", "123456"));
});

Deno.test("a place code is six digits, spaces aside", () => {
  assertEquals(readPlaceCode(" 123 456 "), "123456");
  assertEquals(readPlaceCode("12345"), null);
  assertEquals(readPlaceCode("12345a"), null);
  assertEquals(readPlaceCode(123456), null);
});

Deno.test("a QR's secret is 128 random bits, and six digits no longer pass for one", () => {
  const code = newVisitCode();
  assertEquals(readVisitCode(code), code);
  assertNotEquals(code, newVisitCode());
  assertEquals(readVisitCode("123456"), null);
  assertEquals(readVisitCode(code.toUpperCase() + "0"), null);
  assertEquals(readVisitCode(123456), null);
});

Deno.test("a bill is whole cents, above zero, within the table's limit", () => {
  assertEquals(isBillCents(1), true);
  assertEquals(isBillCents(100_000_000), true);
  assertEquals(isBillCents(0), false);
  assertEquals(isBillCents(10.5), false);
  assertEquals(isBillCents(100_000_001), false);
});

Deno.test("a place code hash is bound to its place and never equals a guest's code hash", async () => {
  const a = await hashPlaceCode("place-a", "123456");
  assertEquals(a, await hashPlaceCode("place-a", "123456"));
  assertNotEquals(a, await hashPlaceCode("place-b", "123456"));
  assertNotEquals(a, await hashVisitCode("place-a", "123456"));
});
