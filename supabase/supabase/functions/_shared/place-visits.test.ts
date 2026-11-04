import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { hashVisitCode, isBillCents, newVisitCode, readVisitCode } from "./place-visits.ts";

Deno.test("a code hash is bound to its place", async () => {
  const a = await hashVisitCode("place-a", "123456");
  assertEquals(a, await hashVisitCode("place-a", "123456"));
  assertNotEquals(a, await hashVisitCode("place-b", "123456"));
});

Deno.test("a typed code is six digits, spaces aside", () => {
  assertEquals(readVisitCode(" 123 456 "), "123456");
  assertEquals(readVisitCode("12345"), null);
  assertEquals(readVisitCode("12345a"), null);
  assertEquals(readVisitCode(123456), null);
  assertEquals(/^\d{6}$/.test(newVisitCode()), true);
});

Deno.test("a bill is whole cents, above zero, within the table's limit", () => {
  assertEquals(isBillCents(1), true);
  assertEquals(isBillCents(100_000_000), true);
  assertEquals(isBillCents(0), false);
  assertEquals(isBillCents(10.5), false);
  assertEquals(isBillCents(100_000_001), false);
});
