import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { hashPlaceCode, readPlaceCode } from "./place-code.ts";

Deno.test("a place code is four digits, spaces aside (MESITA-4521)", () => {
  assertEquals(readPlaceCode("1234"), "1234");
  assertEquals(readPlaceCode(" 12 34 "), "1234");
  assertEquals(readPlaceCode("123"), null);
  assertEquals(readPlaceCode("12345"), null);
  assertEquals(readPlaceCode("123456"), null);
  assertEquals(readPlaceCode("123a"), null);
  assertEquals(readPlaceCode(1234), null);
});

Deno.test("a place code hash is bound to its place", async () => {
  const a = await hashPlaceCode("place-a", "1234");
  assertEquals(a, await hashPlaceCode("place-a", "1234"));
  assertNotEquals(a, await hashPlaceCode("place-b", "1234"));
  assertNotEquals(a, await hashPlaceCode("place-a", "4321"));
  assertEquals(a.length, 64);
});
