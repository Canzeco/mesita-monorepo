import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { hashPlaceCode, readPlaceCode } from "./place-code.ts";

Deno.test("a place code is six digits, spaces aside", () => {
  assertEquals(readPlaceCode("123456"), "123456");
  assertEquals(readPlaceCode(" 123 456 "), "123456");
  assertEquals(readPlaceCode("12345"), null);
  assertEquals(readPlaceCode("1234567"), null);
  assertEquals(readPlaceCode("12345a"), null);
  assertEquals(readPlaceCode(123456), null);
});

Deno.test("a place code hash is bound to its place", async () => {
  const a = await hashPlaceCode("place-a", "123456");
  assertEquals(a, await hashPlaceCode("place-a", "123456"));
  assertNotEquals(a, await hashPlaceCode("place-b", "123456"));
  assertNotEquals(a, await hashPlaceCode("place-a", "654321"));
  assertEquals(a.length, 64);
});
