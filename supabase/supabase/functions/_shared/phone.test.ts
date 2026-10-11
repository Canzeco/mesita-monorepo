import { assertEquals } from "jsr:@std/assert@1";
import { phoneDigits } from "./phone.ts";

Deno.test("phoneDigits strips non-digits", () => {
  assertEquals(phoneDigits("+52 55 1234-5678"), "525512345678");
  assertEquals(phoneDigits("(55) 1234 5678"), "5512345678");
});
